// Weekly summary e-mail for Incheve. Reads Firestore with a service account, sends with Gmail (app password) or Resend.
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import nodemailer from "nodemailer";

export const ADMINS = ["inchevewinebar@gmail.com", "davoavetisyan@gmail.com", "davit.avetisian@gmail.com", "christinasoloyan@gmail.com", "gohar.daniele@gmail.com"];
const TZ = "Asia/Yerevan", TZ_OFF = 4 * 3600e3; // Armenia has no daylight saving

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set in Netlify");
  let j; try { j = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")); } catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON"); }
  if (j.private_key) j.private_key = j.private_key.replace(/\\n/g, "\n");
  return initializeApp({ credential: cert(j), projectId: j.project_id });
}
export const db = () => getFirestore(app());
export const auth = () => getAuth(app());

const pad = n => String(n).padStart(2, "0");
const ymd = ms => { const d = new Date(ms + TZ_OFF); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const dm = k => `${k.slice(8)}.${k.slice(5, 7)}`;
const money = n => Math.round(n || 0).toLocaleString("en-US") + " ֏";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const TX = {
  hy: { title: "Շաբաթական ամփոփում", net: "Մաքուր վաճառք", gp: "Համախառն շահույթ", ofs: "վաճառքից", rc: "Կտրոններ", avg: "Միջին կտրոն", tips: "Թեյավճարներ", cash: "Կանխիկ", card: "Քարտ", transfer: "Փոխանցում", best: "Լավագույն օրը", worst: "Թույլ օրը", top: "Թոփ 5", xf: "Փոխանցման ենթակա", low: "Քիչ է մնացել", vs: "նախորդ շաբաթի համեմատ", days: ["Կիրակի", "Երկուշաբթի", "Երեքշաբթի", "Չորեքշաբթի", "Հինգշաբթի", "Ուրբաթ", "Շաբաթ"], foot: "Ավտոմատ նամակ Incheve Back Office-ից", test: "Փորձնական նամակ" },
  ru: { title: "Итоги недели", net: "Чистые продажи", gp: "Валовая прибыль", ofs: "от продаж", rc: "Чеки", avg: "Средний чек", tips: "Чаевые", cash: "Наличные", card: "Карта", transfer: "Перевод", best: "Лучший день", worst: "Слабый день", top: "Топ 5", xf: "К переводу", low: "Мало осталось", vs: "к прошлой неделе", days: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"], foot: "Автоматическое письмо из Incheve Back Office", test: "Тестовое письмо" },
  en: { title: "Weekly summary", net: "Net sales", gp: "Gross profit", ofs: "of sales", rc: "Receipts", avg: "Average check", tips: "Tips", cash: "Cash", card: "Card", transfer: "Transfer", best: "Best day", worst: "Slowest day", top: "Top 5", xf: "To transfer", low: "Running low", vs: "vs last week", days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], foot: "Automatic e-mail from Incheve Back Office", test: "Test e-mail" },
};

export async function buildWeek(now = Date.now(), F = db()) {
  const today0 = Date.parse(ymd(now) + "T00:00:00Z") - TZ_OFF; // Yerevan midnight today
  const end = today0 + 864e5, start = end - 7 * 864e5, pstart = start - 7 * 864e5;
  const [setS, costS, prodS, staffS, curS, prevS, regS] = await Promise.all([
    F.doc("settings/main").get(), F.doc("costs/all").get(), F.collection("products").get(), F.collection("staff").get(),
    F.collection("sales").where("ts", ">=", start).where("ts", "<", end).get(),
    F.collection("sales").where("ts", ">=", pstart).where("ts", "<", start).get(),
    F.collection("registers").where("openedAt", ">=", start).where("openedAt", "<", end).get(),
  ]);
  const st = setS.exists ? setS.data() : {};
  const costs = (costS.exists && costS.data().map) || {};
  const P = {}; prodS.docs.forEach(d => { P[d.id] = { id: d.id, ...d.data() }; });
  const staff = {}; staffS.docs.forEach(d => { staff[d.id] = d.data().name || ""; });
  const gpb = Math.max(1, +(st.gpb || 6));
  const UM = { g: ["m", 1], mg: ["m", .001], kg: ["m", 1000], ml: ["v", 1], l: ["v", 1000], Piece: ["p", 1], pc: ["p", 1] };
  const uConv = (q, f, t) => { const a = UM[f], b = UM[t]; if (!a || !b || a[0] !== b[0]) return q; return q * a[1] / b[1]; };
  const rQty = r => { const ip = P[r.id]; if (!ip) return +r.qty || 0; const iu = UM[ip.variant] ? ip.variant : "Piece"; return uConv(+r.qty || 0, r.u || iu, iu); };
  const lineCost = id => { const p = P[id]; const b = p && p.bottleId && P[p.bottleId]; if (b && costs[b.id]) return costs[b.id] / gpb * (p.ml ? p.ml / 125 : 1); if (costs[id]) return +costs[id]; return p && Array.isArray(p.recipe) ? p.recipe.reduce((a, r) => a + (+costs[r.id] || 0) * rQty(r), 0) : 0; };
  const live = s => s.docs.map(d => d.data()).filter(s => s.status !== "void");
  const L = live(curS), Lp = live(prevS);
  const sum = (A, f) => A.reduce((a, x) => a + (+f(x) || 0), 0);
  const cogs = A => sum(A, s => sum(s.items || [], l => lineCost(l.id) * (+l.qty || 0)));
  const net = sum(L, s => s.total), pnet = sum(Lp, s => s.total), gp = net - cogs(L), pgp = pnet - cogs(Lp), tips = sum(L, s => s.tip);
  const pay = { cash: 0, card: 0, transfer: 0 };
  L.forEach(s => { const parts = Array.isArray(s.payments) && s.payments.length ? s.payments : [{ pay: s.pay, amount: (s.total || 0) + (s.tip || 0) }]; const tot = sum(parts, p => p.amount) || 1; const tip = +s.tip || 0; parts.forEach(p => { pay[p.pay] = (pay[p.pay] || 0) + p.amount - tip * p.amount / tot; }); });
  const byD = {}; L.forEach(s => { const k = s.day || ymd(s.ts); byD[k] = (byD[k] || 0) + (s.total || 0); });
  const dS = Object.entries(byD).sort((a, b) => b[1] - a[1]);
  const q = {}; L.forEach(s => (s.items || []).forEach(l => { const k = l.name || (P[l.id] || {}).name || "?"; q[k] = (q[k] || 0) + (+l.qty || 0) * (+l.price || 0); }));
  const top = Object.entries(q).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const xf = {}; regS.docs.map(d => d.data()).filter(r => r.status === "closed" && r.transfer).forEach(r => { const k = r.transfer.staffId || ""; xf[k] = (xf[k] || 0) + (+r.transfer.salary || 0) + (+r.transfer.tips || 0); });
  const sold = {}; L.forEach(s => (s.items || []).forEach(l => { const p = P[l.id]; const b = p && p.bottleId ? P[p.bottleId] : p; if (b) sold[b.id] = 1; }));
  const low = Object.values(P).filter(p => p.active !== false && !p.bottleId && p.stock != null && sold[p.id] && (p.stock <= 0 || (p.low != null && p.stock <= +p.low))).slice(0, 10);
  return { st, a: ymd(start), b: ymd(end - 1), n: L.length, net, pnet, gp, pgp, tips, pay, best: dS[0], worst: dS.length > 1 ? dS[dS.length - 1] : null, top, xf: Object.entries(xf).filter(([, v]) => v > 0).map(([id, v]) => [staff[id] || "—", v]), low, gpb };
}

export function render(W, lang = "hy", test = false) {
  const T = TX[lang] || TX.hy;
  const pct = (a, b) => b > 0 ? Math.round((a - b) / b * 100) : null;
  const pc = pct(W.net, W.pnet), gpc = pct(W.gp, W.pgp), mg = W.net ? Math.round(W.gp / W.net * 100) : null;
  const sg = v => v == null ? "" : `${v > 0 ? "+" : ""}${v}%`;
  const day = k => `${T.days[new Date(k + "T12:00:00Z").getUTCDay()]} ${dm(k)}`;
  const stock = p => { const v = +p.stock || 0; if (p.variant === "Bottle" || p.group === "wine") { const tot = Math.round(v * W.gpb), f = Math.floor(tot / W.gpb), r = tot % W.gpb; return lang === "hy" ? `${f} շիշ${r ? ` + ${r} գավ.` : ""}` : lang === "ru" ? `${f} бут.${r ? ` + ${r} бок.` : ""}` : `${f} btl${r ? ` + ${r} gl.` : ""}`; } return `${Math.round(v * 100) / 100} ${lang === "hy" ? "հատ" : lang === "ru" ? "шт." : "pcs"}`; };
  const subject = `${test ? "[" + T.test + "] " : ""}Incheve · ${T.title} · ${dm(W.a)} – ${dm(W.b)}`;
  const lines = [`Incheve · ${T.title} · ${dm(W.a)} – ${dm(W.b)}`, "",
    `${T.net}: ${money(W.net)}${pc != null ? ` (${sg(pc)})` : ""}`,
    `${T.gp}: ${money(W.gp)}${mg != null ? ` · ${mg}%` : ""}${gpc != null ? ` (${sg(gpc)})` : ""}`,
    `${T.rc}: ${W.n} · ${T.avg}: ${money(W.n ? W.net / W.n : 0)}`,
    `${T.cash}: ${money(W.pay.cash)} · ${T.card}: ${money(W.pay.card)}${W.pay.transfer ? ` · ${T.transfer}: ${money(W.pay.transfer)}` : ""}`,
    `${T.tips}: ${money(W.tips)}`];
  if (W.best) lines.push("", `${T.best}: ${day(W.best[0])} · ${money(W.best[1])}`);
  if (W.worst) lines.push(`${T.worst}: ${day(W.worst[0])} · ${money(W.worst[1])}`);
  if (W.top.length) lines.push("", T.top + ":", ...W.top.map(([n, v], i) => `${i + 1}. ${n} — ${money(v)}`));
  if (W.xf.length) lines.push("", T.xf + ":", ...W.xf.map(([n, v]) => `${n} — ${money(v)}`));
  if (W.low.length) lines.push("", T.low + ":", ...W.low.map(p => `${p.name} — ${stock(p)}`));
  const text = lines.join("\n") + `\n\n— ${T.foot}`;
  const row = (a, b, strong) => `<tr><td style="padding:7px 0;color:#5b6470;vertical-align:top">${esc(a)}</td><td style="padding:7px 0 7px 12px;text-align:right;white-space:nowrap;vertical-align:top;${strong ? "font-weight:700" : ""}">${b}</td></tr>`;
  const list = (h, arr) => arr.length ? `<h3 style="font-size:14px;margin:22px 0 6px;color:#18385b">${esc(h)}</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${arr.map(([a, b]) => row(a, esc(b))).join("")}</table>` : "";
  const chip = v => v == null ? "" : ` <span style="font-size:12px;font-weight:600;color:${v >= 0 ? "#2e7d4f" : "#c4362a"}">${sg(v)}</span>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f2f4f7;font-family:-apple-system,Segoe UI,Roboto,'Noto Sans Armenian',Arial,sans-serif;color:#1c2430">
<div style="max-width:520px;margin:0 auto;padding:20px 14px"><div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e3e7ec">
<div style="background:#18385b;color:#fff;padding:18px 20px"><div style="font-size:12px;opacity:.8">${esc(W.st.name || "Incheve Wine Bar")}</div><div style="font-size:20px;font-weight:700;margin-top:2px">${esc(T.title)}</div><div style="font-size:13px;opacity:.85;margin-top:2px">${dm(W.a)} – ${dm(W.b)}</div></div>
<div style="padding:18px 20px">
<div style="font-size:13px;color:#5b6470">${esc(T.net)}</div><div style="font-size:28px;font-weight:700;margin:2px 0">${money(W.net)}${chip(pc)}</div>
<div style="background:#e8f3ec;border-radius:12px;padding:10px 12px;margin:12px 0"><div style="font-size:13px;color:#3d5a48">${esc(T.gp)}</div><div style="font-size:20px;font-weight:700;color:#2e7d4f">${money(W.gp)} <span style="font-size:12px;font-weight:400;color:#3d5a48">${mg != null ? mg + "% " + esc(T.ofs) : ""}</span>${chip(gpc)}</div></div>
<table style="width:100%;border-collapse:collapse;font-size:14px">${row(T.rc, W.n)}${row(T.avg, money(W.n ? W.net / W.n : 0))}${row(T.cash, money(W.pay.cash))}${row(T.card, money(W.pay.card))}${W.pay.transfer ? row(T.transfer, money(W.pay.transfer)) : ""}${row(T.tips, money(W.tips))}${W.best ? row(T.best, esc(day(W.best[0])) + " · " + money(W.best[1])) : ""}${W.worst ? row(T.worst, esc(day(W.worst[0])) + " · " + money(W.worst[1])) : ""}</table>
${list(T.top, W.top.map(([n, v], i) => [`${i + 1}. ${n}`, money(v)]))}${list(T.xf, W.xf.map(([n, v]) => [n, money(v)]))}${list(T.low, W.low.map(p => [p.name, stock(p)]))}
</div></div><div style="text-align:center;font-size:11px;color:#8a93a0;margin-top:10px">${esc(T.foot)}</div></div></body></html>`;
  return { subject, text, html };
}

export function recipients(st, extra) {
  const raw = extra != null ? extra : ((st.wkMail && st.wkMail.to) || []);
  const arr = Array.isArray(raw) ? raw : String(raw).split(/[\s,;]+/);
  return [...new Set(arr.map(x => String(x).trim().toLowerCase()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))].slice(0, 20);
}

export async function send(to, m) {
  if (!to.length) throw new Error("no recipients");
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const tr = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, "") } });
    await tr.sendMail({ from: `Incheve <${process.env.GMAIL_USER}>`, bcc: to, subject: m.subject, text: m.text, html: m.html });
    return "gmail";
  }
  if (process.env.RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "Incheve <onboarding@resend.dev>", to, subject: m.subject, text: m.text, html: m.html }) });
    if (!r.ok) throw new Error("Resend: " + (await r.text()).slice(0, 200));
    return "resend";
  }
  throw new Error("Mail is not set up: add GMAIL_USER + GMAIL_APP_PASSWORD in Netlify");
}

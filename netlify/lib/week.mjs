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
  hy: { title: "Շաբաթական ամփոփում", net: "Մաքուր վաճառք", gp: "Համախառն շահույթ", ofs: "վաճառքից", rc: "Կտրոններ", avg: "Միջին կտրոն", tips: "Թեյավճարներ", cash: "Կանխիկ", card: "Քարտ", transfer: "Փոխանցում", best: "Լավագույն օրը", worst: "Թույլ օրը", top: "Թոփ 5", xf: "Փոխանցման ենթակա", wk: "Շաբաթական վճարում", low: "Քիչ է մնացել", vs: "նախորդ շաբաթի համեմատ", days: ["Կիրակի", "Երկուշաբթի", "Երեքշաբթի", "Չորեքշաբթի", "Հինգշաբթի", "Ուրբաթ", "Շաբաթ"], foot: "Ավտոմատ նամակ Incheve Back Office-ից", test: "Փորձնական նամակ", mtitle: "Ամսական ամփոփում", expS: "Ծախսեր", salS: "Աշխատավարձ", lossS: "Կորուստ", mvs: "նախորդ ամսվա համեմատ", top10: "Թոփ 10", exp: "Ծախսեր ըստ կատեգորիայի", pur: "Ապրանքի գնումներ ըստ մատակարարի", sal: "Աշխատավարձ ըստ աշխատակցի", res: "Արդյունք", profit: "Մաքուր շահույթ (մոտավոր)", loss: "Կորուստ (դուրսգրում, գույքագրում)", total: "Ընդամենը", weeks: "Ըստ շաբաթների", wkof: "շաբաթ", nocost: "Գինիներ առանց ինքնարժեքի", nocostH: "լրացրեք, որ շահույթը ճիշտ հաշվվի", wdays: "աշխատանքային օր", cats: { e_wine: "Գինու գնում", e_food: "Սնունդ և խմիչք", e_cons: "Տնտեսական ծախսեր", e_rent: "Վարձակալություն", e_util: "Կոմունալ", e_supply: "Պարագաներ", e_mkt: "Մարքեթինգ", e_tax: "Հարկեր", e_repair: "Վերանորոգում", e_other: "Այլ", e_salary: "Աշխատավարձ" }, months: ["Հունվար", "Փետրվար", "Մարտ", "Ապրիլ", "Մայիս", "Հունիս", "Հուլիս", "Օգոստոս", "Սեպտեմբեր", "Հոկտեմբեր", "Նոյեմբեր", "Դեկտեմբեր"] },
  ru: { title: "Итоги недели", net: "Чистые продажи", gp: "Валовая прибыль", ofs: "от продаж", rc: "Чеки", avg: "Средний чек", tips: "Чаевые", cash: "Наличные", card: "Карта", transfer: "Перевод", best: "Лучший день", worst: "Слабый день", top: "Топ 5", xf: "К переводу", wk: "Еженедельная выплата", low: "Мало осталось", vs: "к прошлой неделе", days: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"], foot: "Автоматическое письмо из Incheve Back Office", test: "Тестовое письмо", mtitle: "Итоги месяца", expS: "Расходы", salS: "Зарплата", lossS: "Потери", mvs: "к прошлому месяцу", top10: "Топ 10", exp: "Расходы по категориям", pur: "Закупки по поставщикам", sal: "Зарплата по сотрудникам", res: "Итог", profit: "Чистая прибыль (прибл.)", loss: "Потери (списание, инвентаризация)", total: "Итого", weeks: "По неделям", wkof: "неделя", nocost: "Вина без себестоимости", nocostH: "заполните, чтобы прибыль считалась верно", wdays: "рабочих дней", cats: { e_wine: "Закупка вина", e_food: "Еда и напитки", e_cons: "Хозтовары", e_rent: "Аренда", e_util: "Коммунальные", e_supply: "Расходники", e_mkt: "Маркетинг", e_tax: "Налоги", e_repair: "Ремонт", e_other: "Прочее", e_salary: "Зарплата" }, months: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"] },
  en: { title: "Weekly summary", net: "Net sales", gp: "Gross profit", ofs: "of sales", rc: "Receipts", avg: "Average check", tips: "Tips", cash: "Cash", card: "Card", transfer: "Transfer", best: "Best day", worst: "Slowest day", top: "Top 5", xf: "To transfer", wk: "Weekly payment", low: "Running low", vs: "vs last week", days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], foot: "Automatic e-mail from Incheve Back Office", test: "Test e-mail", mtitle: "Monthly summary", expS: "Expenses", salS: "Salaries", lossS: "Losses", mvs: "vs last month", top10: "Top 10", exp: "Expenses by category", pur: "Stock purchases by supplier", sal: "Salaries by person", res: "Result", profit: "Net profit (approx.)", loss: "Losses (write-offs, counts)", total: "Total", weeks: "By week", wkof: "week", nocost: "Wines without cost", nocostH: "fill in so profit is right", wdays: "working days", cats: { e_wine: "Wine purchase", e_food: "Food & drinks", e_cons: "Consumables", e_rent: "Rent", e_util: "Utilities", e_supply: "Supplies", e_mkt: "Marketing", e_tax: "Taxes", e_repair: "Repairs", e_other: "Other", e_salary: "Salaries" }, months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] },
};

export async function buildWeek(now = Date.now(), F = db()) {
  const today0 = Date.parse(ymd(now) + "T00:00:00Z") - TZ_OFF; // Yerevan midnight today
  const end = today0 + 864e5, start = end - 7 * 864e5, pstart = start - 7 * 864e5;
  return buildRange(start, end, pstart, F, false);
}
// previous calendar month (Yerevan time), compared with the month before it
export async function buildMonth(now = Date.now(), F = db()) {
  const d = new Date(now + TZ_OFF); const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const at = (yy, mm) => Date.UTC(yy, mm, 1) - TZ_OFF;
  const end = at(y, m), start = at(y, m - 1), pstart = at(y, m - 2);
  const W = await buildRange(start, end, pstart, F, true); W.kind = "month"; W.month = new Date(start + TZ_OFF + 12 * 3600e3).getUTCMonth(); W.year = new Date(start + TZ_OFF + 12 * 3600e3).getUTCFullYear(); return W;
}
async function buildRange(start, end, pstart, F, detail) {
  const [setS, costS, prodS, staffS, curS, prevS, regS, payS] = await Promise.all([
    F.doc("settings/main").get(), F.doc("costs/all").get(), F.collection("products").get(), F.collection("staff").get(),
    F.collection("sales").where("ts", ">=", start).where("ts", "<", end).get(),
    F.collection("sales").where("ts", ">=", pstart).where("ts", "<", start).get(),
    F.collection("registers").where("openedAt", ">=", start).where("openedAt", "<", end).get(),
    F.collection("pay").get().catch(() => ({ docs: [] })),
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
  const wkPay = payS.docs.map(d => ({ id: d.id, w: d.data().weekly })).filter(x => x.w && +x.w.amount > 0).map(x => [staff[x.id] || "—", +x.w.amount, x.w.label || "", +x.w.day || 0]);
  const out = { kind: "week", wkPay, st, a: ymd(start), b: ymd(end - 1), n: L.length, net, pnet, gp, pgp, tips, pay, best: dS[0], worst: dS.length > 1 ? dS[dS.length - 1] : null, top, xf: Object.entries(xf).filter(([, v]) => v > 0).map(([id, v]) => [staff[id] || "—", v]), low, gpb };
  if (!detail) return out;
  out.top = Object.entries(q).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const da = ymd(start), db_ = ymd(end - 1);
  const [expS, movS, paysS] = await Promise.all([
    F.collection("expenses").where("date", ">=", da).where("date", "<=", db_).get().catch(() => ({ docs: [] })),
    F.collection("moves").where("date", ">=", da).where("date", "<=", db_).get().catch(() => ({ docs: [] })),
    F.collection("payments").where("date", ">=", da).where("date", "<=", db_).get().catch(() => ({ docs: [] }))]);
  const moves = movS.docs.map(d => d.data()), ins = moves.filter(m => m.type === "in");
  const exps = expS.docs.map(d => d.data()).filter(e => !(e.fromInv || ins.some(m => m.date === e.date && Math.round(+m.total || 0) === Math.round(+e.amount || 0))));
  const expCat = {}; exps.forEach(e => { const k = e.cat || "e_other"; expCat[k] = (expCat[k] || 0) + (+e.amount || 0); });
  const sup = {}; ins.forEach(m => { const k = m.supplier || "—"; sup[k] = (sup[k] || 0) + (+m.total || 0); });
  const salBy = {}; paysS.docs.map(d => d.data()).forEach(p => { const k = staff[p.staffId] || "—"; salBy[k] = (salBy[k] || 0) + (+p.amount || 0); });
  regS.docs.map(d => d.data()).forEach(r => { if (r.salaryTaken && +r.salaryTaken.amount > 0) { const k = staff[r.salaryTaken.staffId] || "—"; salBy[k] = (salBy[k] || 0) + (+r.salaryTaken.amount); } });
  let loss = 0; moves.forEach(m => { if (m.type === "off") (m.items || []).forEach(l => loss += lineCost(l.id) * (+l.qty || 0)); if (m.type === "count" && +m.diffValue < 0) loss += -m.diffValue; });
  const expT = Object.values(expCat).reduce((a, v) => a + v, 0), salT = Object.values(salBy).reduce((a, v) => a + v, 0), purT = Object.values(sup).reduce((a, v) => a + v, 0);
  const wk = {}; L.forEach(s => { const k = s.day || ymd(s.ts); const d = new Date(k + "T12:00:00Z"); const mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5); const wkey = mon.toISOString().slice(0, 10); wk[wkey] = (wk[wkey] || 0) + (s.total || 0); });
  const noCost = Object.values(P).filter(p => p.active !== false && !p.archived && !p.bottleId && p.group === "wine" && !costs[p.id] && (p.stock == null || p.stock > 0)).map(p => p.name).sort();
  Object.assign(out, { expCat: Object.entries(expCat).sort((a, b) => b[1] - a[1]), sup: Object.entries(sup).sort((a, b) => b[1] - a[1]), salBy: Object.entries(salBy).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]), expT, salT, purT, loss, profit: gp - expT - salT - loss, weeks: Object.entries(wk).sort(), noCost, days: Object.keys(byD).length });
  return out;
}

export function render(W, lang = "hy", test = false) {
  const T0 = TX[lang] || TX.hy; const MON = W.kind === "month"; const T = MON ? { ...T0, title: T0.mtitle, vs: T0.mvs, top: T0.top10 } : T0;
  const period = MON ? `${T0.months[W.month]} ${W.year}` : `${dm(W.a)} – ${dm(W.b)}`;
  const pct = (a, b) => b > 0 ? Math.round((a - b) / b * 100) : null;
  const pc = pct(W.net, W.pnet), gpc = pct(W.gp, W.pgp), mg = W.net ? Math.round(W.gp / W.net * 100) : null;
  const sg = v => v == null ? "" : `${v > 0 ? "+" : ""}${v}%`;
  const day = k => `${T.days[new Date(k + "T12:00:00Z").getUTCDay()]} ${dm(k)}`;
  const stock = p => { const v = +p.stock || 0; if (p.variant === "Bottle" || p.group === "wine") { const tot = Math.round(v * W.gpb), f = Math.floor(tot / W.gpb), r = tot % W.gpb; return lang === "hy" ? `${f} շիշ${r ? ` + ${r} գավ.` : ""}` : lang === "ru" ? `${f} бут.${r ? ` + ${r} бок.` : ""}` : `${f} btl${r ? ` + ${r} gl.` : ""}`; } return `${Math.round(v * 100) / 100} ${lang === "hy" ? "հատ" : lang === "ru" ? "шт." : "pcs"}`; };
  const subject = `${test ? "[" + T.test + "] " : ""}Incheve · ${T.title} · ${period}`;
  const lines = [`Incheve · ${T.title} · ${period}`, "",
    `${T.net}: ${money(W.net)}${pc != null ? ` (${sg(pc)})` : ""}`,
    `${T.gp}: ${money(W.gp)}${mg != null ? ` · ${mg}%` : ""}${gpc != null ? ` (${sg(gpc)})` : ""}`,
    `${T.rc}: ${W.n} · ${T.avg}: ${money(W.n ? W.net / W.n : 0)}`,
    `${T.cash}: ${money(W.pay.cash)} · ${T.card}: ${money(W.pay.card)}${W.pay.transfer ? ` · ${T.transfer}: ${money(W.pay.transfer)}` : ""}`,
    `${T.tips}: ${money(W.tips)}`];
  if (W.best) lines.push("", `${T.best}: ${day(W.best[0])} · ${money(W.best[1])}`);
  if (W.worst) lines.push(`${T.worst}: ${day(W.worst[0])} · ${money(W.worst[1])}`);
  if (W.top.length) lines.push("", T.top + ":", ...W.top.map(([n, v], i) => `${i + 1}. ${n} — ${money(v)}`));
  if (W.wkPay.length) lines.push("", T.wk + ":", ...W.wkPay.map(([n, v, l, d]) => `${n}${l ? " · " + l : ""} — ${money(v)} (${T.days[d]})`));
  if (W.xf.length) lines.push("", T.xf + ":", ...W.xf.map(([n, v]) => `${n} — ${money(v)}`));
  if (W.low.length) lines.push("", T.low + ":", ...W.low.map(p => `${p.name} — ${stock(p)}`));
  const cat = k => (T0.cats && T0.cats[k]) || k;
  if (MON) {
    lines.push("", T0.res + ":", `${T.net}: ${money(W.net)}`, `${T.gp}: ${money(W.gp)}`, `− ${T0.expS}: ${money(W.expT)}`, `− ${T0.salS}: ${money(W.salT)}`, ...(W.loss ? [`− ${T0.lossS}: ${money(W.loss)}`] : []), `= ${T0.profit}: ${money(W.profit)}`);
    if (W.expCat.length) lines.push("", T0.exp + ":", ...W.expCat.map(([k, v]) => `${cat(k)} — ${money(v)}`));
    if (W.sup.length) lines.push("", T0.pur + ":", ...W.sup.map(([k, v]) => `${k} — ${money(v)}`));
    if (W.salBy.length) lines.push("", T0.sal + ":", ...W.salBy.map(([k, v]) => `${k} — ${money(v)}`));
    if (W.weeks.length) lines.push("", T0.weeks + ":", ...W.weeks.map(([k, v]) => `${dm(k)} — ${money(v)}`));
    if (W.noCost.length) lines.push("", `${T0.nocost} (${W.noCost.length}):`, W.noCost.slice(0, 30).join(", "));
  }
  const text = lines.join("\n") + `\n\n— ${T.foot}`;
  const row = (a, b, strong) => `<tr><td style="padding:7px 0;color:#5b6470;vertical-align:top">${esc(a)}</td><td style="padding:7px 0 7px 12px;text-align:right;white-space:nowrap;vertical-align:top;${strong ? "font-weight:700" : ""}">${b}</td></tr>`;
  const list = (h, arr) => arr.length ? `<h3 style="font-size:14px;margin:22px 0 6px;color:#18385b">${esc(h)}</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${arr.map(([a, b]) => row(a, esc(b))).join("")}</table>` : "";
  const chip = v => v == null ? "" : ` <span style="font-size:12px;font-weight:600;color:${v >= 0 ? "#2e7d4f" : "#c4362a"}">${sg(v)}</span>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f2f4f7;font-family:-apple-system,Segoe UI,Roboto,'Noto Sans Armenian',Arial,sans-serif;color:#1c2430">
<div style="max-width:520px;margin:0 auto;padding:20px 14px"><div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e3e7ec">
<div style="background:#18385b;color:#fff;padding:18px 20px"><div style="font-size:12px;opacity:.8">${esc(W.st.name || "Incheve Wine Bar")}</div><div style="font-size:20px;font-weight:700;margin-top:2px">${esc(T.title)}</div><div style="font-size:13px;opacity:.85;margin-top:2px">${esc(period)}${MON && W.days ? ` · ${W.days} ${esc(T0.wdays)}` : ""}</div></div>
<div style="padding:18px 20px">
<div style="font-size:13px;color:#5b6470">${esc(T.net)}</div><div style="font-size:28px;font-weight:700;margin:2px 0">${money(W.net)}${chip(pc)}</div>
<div style="background:#e8f3ec;border-radius:12px;padding:10px 12px;margin:12px 0"><div style="font-size:13px;color:#3d5a48">${esc(T.gp)}</div><div style="font-size:20px;font-weight:700;color:#2e7d4f">${money(W.gp)} <span style="font-size:12px;font-weight:400;color:#3d5a48">${mg != null ? mg + "% " + esc(T.ofs) : ""}</span>${chip(gpc)}</div></div>
<table style="width:100%;border-collapse:collapse;font-size:14px">${row(T.rc, W.n)}${row(T.avg, money(W.n ? W.net / W.n : 0))}${row(T.cash, money(W.pay.cash))}${row(T.card, money(W.pay.card))}${W.pay.transfer ? row(T.transfer, money(W.pay.transfer)) : ""}${row(T.tips, money(W.tips))}${W.best ? row(T.best, esc(day(W.best[0])) + " · " + money(W.best[1])) : ""}${W.worst ? row(T.worst, esc(day(W.worst[0])) + " · " + money(W.worst[1])) : ""}</table>
${list(T.top, W.top.map(([n, v], i) => [`${i + 1}. ${n}`, money(v)]))}${list(T.wk, W.wkPay.map(([n, v, l, d]) => [n + (l ? " · " + l : "") + " (" + T.days[d] + ")", money(v)]))}${list(T.xf, W.xf.map(([n, v]) => [n, money(v)]))}${list(T.low, W.low.map(p => [p.name, stock(p)]))}
${MON ? (() => { const tot = (h, arr, sum) => arr.length ? `<h3 style="font-size:14px;margin:22px 0 6px;color:#18385b">${esc(h)}</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${arr.map(([a, b]) => row(a, money(b))).join("")}${row(T0.total, money(sum), true)}</table>` : "";
  const res = `<h3 style="font-size:14px;margin:22px 0 6px;color:#18385b">${esc(T0.res)}</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${row(T.net, money(W.net))}${row(T.gp, money(W.gp))}${row("− " + T0.expS, money(W.expT))}${row("− " + T0.salS, money(W.salT))}${W.loss ? row("− " + T0.lossS, money(W.loss)) : ""}</table><div style="background:${W.profit >= 0 ? "#e8f3ec" : "#fdecea"};border-radius:12px;padding:10px 12px;margin-top:8px;display:flex;justify-content:space-between;font-weight:700"><span>${esc(T0.profit)}</span><span style="color:${W.profit >= 0 ? "#2e7d4f" : "#c4362a"}">${money(W.profit)}</span></div>`;
  const wmx = Math.max(1, ...W.weeks.map(x => x[1]));
  const weeks = W.weeks.length ? `<h3 style="font-size:14px;margin:22px 0 6px;color:#18385b">${esc(T0.weeks)}</h3>${W.weeks.map(([k, v]) => `<div style="display:flex;align-items:center;gap:8px;font-size:13px;margin:5px 0"><span style="width:44px;color:#5b6470">${dm(k)}</span><span style="flex:1;background:#eef1f4;border-radius:6px;height:12px;overflow:hidden"><span style="display:block;height:12px;width:${Math.round(v / wmx * 100)}%;background:#57b98f"></span></span><span style="width:96px;text-align:right;font-weight:600">${money(v)}</span></div>`).join("")}` : "";
  const nc = W.noCost.length ? `<div style="background:#fff4e0;border-radius:12px;padding:10px 12px;margin-top:22px;font-size:13px"><b>${esc(T0.nocost)} · ${W.noCost.length}</b><div style="color:#7a5a20;margin:2px 0 6px">${esc(T0.nocostH)}</div>${esc(W.noCost.slice(0, 30).join(", "))}${W.noCost.length > 30 ? " …" : ""}</div>` : "";
  return res + tot(T0.exp, W.expCat.map(([k, v]) => [cat(k), v]), W.expT) + tot(T0.pur, W.sup, W.purT) + tot(T0.sal, W.salBy, W.salT) + weeks + nc; })() : ""}
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

// last-send status for the Settings screen (no addresses or keys stored, only counts and the error text)
export async function logStatus(kind, ok, info) {
  try { await db().doc("blobs/wkmail").set({ [kind]: { at: Date.now(), ok: !!ok, n: info && info.n || 0, via: info && info.via || "", err: info && info.err ? String(info.err).slice(0, 200) : "" } }, { merge: true }); } catch (e) { console.error("status log failed", e && e.message); }
}

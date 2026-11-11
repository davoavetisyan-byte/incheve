// "Send a test e-mail" (Settings) and "Send by e-mail" (weekly summary) buttons. Only signed-in owners (admin e-mails) may call it.
import { ADMINS, auth, buildWeek, render, recipients, send, logStatus } from "../lib/week.mjs";
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
export default async (req) => {
  if (req.method !== "POST") return J({ error: "POST only" }, 405);
  try {
    const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!tok) return J({ error: "sign in first" }, 401);
    const u = await auth().verifyIdToken(tok);
    if (!u.email || !u.email_verified || !ADMINS.includes(u.email.toLowerCase())) return J({ error: "owners only" }, 403);
    let body = {}; try { body = await req.json(); } catch (e) {}
    const W = await buildWeek();
    const to = recipients(W.st, body.to != null ? body.to : null);
    if (!to.length) return J({ error: "no recipients" }, 400);
    const via = await send(to, render(W, body.lang || (W.st.wkMail && W.st.wkMail.lang) || "hy", !body.real));
    await logStatus("test", true, { n: to.length, via });
    return J({ ok: true, to, via });
  } catch (e) { return J({ error: (e && e.message) || "failed" }, 500); }
};

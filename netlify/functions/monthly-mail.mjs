// Runs on the 1st of every month at 10:00 Yerevan time (06:00 UTC) and e-mails last month's detailed summary.
import { buildMonth, render, recipients, send, logStatus } from "../lib/week.mjs";
export default async () => {
  try {
    const W = await buildMonth();
    const cfg = W.st.wkMail || {};
    if (!cfg.monthly) { console.log("monthly mail is off"); await logStatus("month", false, { err: "off" }); return; }
    const to = recipients(W.st);
    if (!to.length) { await logStatus("month", false, { err: "no recipients" }); return; }
    const via = await send(to, render(W, cfg.lang || "hy"));
    console.log("monthly mail sent", to.length, via); await logStatus("month", true, { n: to.length, via });
  } catch (e) { console.error("monthly mail failed", e && e.message); await logStatus("month", false, { err: e && e.message }); }
};
export const config = { schedule: "0 6 1 * *" };

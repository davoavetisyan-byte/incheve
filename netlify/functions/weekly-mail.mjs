// Runs every Sunday 23:30 Yerevan time (19:30 UTC) and e-mails the weekly summary to the addresses in Settings.
import { buildWeek, render, recipients, send, logStatus } from "../lib/week.mjs";
export default async () => {
  try {
    const W = await buildWeek();
    const cfg = W.st.wkMail || {};
    if (!cfg.on) { console.log("weekly mail is off"); await logStatus("auto", false, { err: "off" }); return; }
    const to = recipients(W.st);
    if (!to.length) { console.log("no recipients"); await logStatus("auto", false, { err: "no recipients" }); return; }
    const via = await send(to, render(W, cfg.lang || "hy"));
    console.log("weekly mail sent", to.length, via); await logStatus("auto", true, { n: to.length, via });
  } catch (e) { console.error("weekly mail failed", e && e.message); await logStatus("auto", false, { err: e && e.message });  }
};
export const config = { schedule: "30 19 * * 0" };

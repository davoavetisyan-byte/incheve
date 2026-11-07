// Runs every Sunday 23:30 Yerevan time (19:30 UTC) and e-mails the weekly summary to the addresses in Settings.
import { buildWeek, render, recipients, send } from "../lib/week.mjs";
export default async () => {
  try {
    const W = await buildWeek();
    const cfg = W.st.wkMail || {};
    if (!cfg.on) { console.log("weekly mail is off"); return; }
    const to = recipients(W.st);
    if (!to.length) { console.log("no recipients"); return; }
    const via = await send(to, render(W, cfg.lang || "hy"));
    console.log("weekly mail sent", to.length, via);
  } catch (e) { console.error("weekly mail failed", e && e.message); }
};
export const config = { schedule: "30 19 * * 0" };

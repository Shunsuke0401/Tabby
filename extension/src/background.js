import { installIdleWatcher } from "./idle-watcher.js";
import { gatherCandidates, closeAndRecord, reopen } from "./tabs-io.js";
import { classify } from "./api.js";
import { splitByAction } from "./decision.js";
import { getClosedLog } from "./store.js";
import { REVIEW_ALARM_MINUTES } from "./config.js";

console.log("Tabby background loaded");

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.alarms.create("review", { periodInMinutes: REVIEW_ALARM_MINUTES });
});

installIdleWatcher();

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument?.()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Tabby voice: capture mic and play Gemini Live audio.",
  });
}

async function runReview() {
  const candidates = await gatherCandidates();
  const byId = Object.fromEntries(candidates.map(c => [c.id, c]));
  const results = await classify(candidates);
  const { autoClose, suggest } = splitByAction(results);
  for (const r of autoClose) if (byId[r.id]) await closeAndRecord(r, byId[r.id]);
  const enrich = r => ({ ...r, ...byId[r.id] });
  return { autoClosed: autoClose.map(enrich), suggest: suggest.map(enrich) };
}

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg === "DEBUG_GATHER") { gatherCandidates().then(send); return true; }
  if (msg === "REVIEW_NOW") { runReview().then(send); return true; }
  if (msg?.type === "CLOSE_ONE") {
    gatherCandidates().then(async cands => {
      const c = cands.find(x => x.id === msg.id);
      if (c) await closeAndRecord({ description: msg.description, keywords: msg.keywords }, c);
      send({ ok: true });
    });
    return true;
  }
  if (msg?.type === "REOPEN") { reopen(msg.url).then(() => send({ ok: true })); return true; }
  if (msg === "GET_CLOSED") { getClosedLog().then(send); return true; }
});

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== "review") return;
  const result = await runReview();
  await chrome.storage.local.set({ lastReview: result, lastReviewAt: Date.now() });
});

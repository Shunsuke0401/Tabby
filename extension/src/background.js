import { installIdleWatcher } from "./idle-watcher.js";
import { gatherCandidates, closeAndRecord, reopen } from "./tabs-io.js";
import { classify } from "./api.js";
import { splitByAction } from "./decision.js";
import { getClosedLog } from "./store.js";

console.log("Tabby background loaded");

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

installIdleWatcher();

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

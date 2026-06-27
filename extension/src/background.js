import { installIdleWatcher } from "./idle-watcher.js";
import { gatherCandidates, closeAndRecord, reopen } from "./tabs-io.js";
import { classify, matchClosed } from "./api.js";
import { splitByAction } from "./decision.js";
import { getClosedLog } from "./store.js";
import { REVIEW_ALARM_MINUTES, BACKEND_URL } from "./config.js";

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

// Execute the tools Gemini Live calls during a voice conversation.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "VOICE_TOOL") return;
  (async () => {
    const { id, name, args } = msg.call;
    console.log("[Tabby] VOICE_TOOL", name, JSON.stringify(args));
    let result = { ok: true };
    let note = "";
    try {
      if (name === "closeTabs") {
        const ids = (args?.ids ?? []).map(Number);
        let closed = 0;
        for (const tid of ids) {
          try {
            const tab = await chrome.tabs.get(tid);              // close ANY tab by id, not just idle candidates
            await closeAndRecord({ description: tab.title, keywords: [] }, { id: tid, url: tab.url, title: tab.title });
            closed++;
          } catch (e) { console.warn("[Tabby] couldn't close tab", tid, e?.message); }
        }
        result = { ok: closed > 0, closed };
        note = `closeTabs ${JSON.stringify(ids)} → closed ${closed}/${ids.length}`;
      } else if (name === "reopenTab") {
        const url = await matchClosed(args?.query ?? "");
        if (url) await reopen(url);
        result = { ok: !!url };
        note = `reopenTab "${args?.query}" → ${url ? "reopened" : "no match"}`;
      } else if (name === "reviewTabs") {
        const { autoClosed, suggest } = await runReview();   // scan happens ONLY when Mark asks
        result = {
          closed: autoClosed.map(r => ({ id: r.id, title: r.title, reason: r.reason })),
          suggested: suggest.map(r => ({ id: r.id, title: r.title, reason: r.reason })),
        };
        note = `reviewTabs → auto-closed ${autoClosed.length}, suggested ${suggest.length}`;
      } else {
        note = `${name} (no-op)`; // keepTabs
      }
    } catch (e) {
      result = { ok: false };
      note = `${name} ERROR: ${e?.message ?? e}`;
    }
    console.log("[Tabby]", note);
    chrome.runtime.sendMessage({ type: "VOICE_DEBUG", text: note });
    chrome.runtime.sendMessage({ type: "VOICE_TOOL_RESULT", id, name, result });
  })();
});

// "Talk to Tabby" entry point: open the offscreen doc, run a review, kick off the voice session.
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg !== "TALK") return;
  (async () => {
    await ensureOffscreen();
    // Listen-first: do NOT scan/classify here. Just hand the model the open tabs so it can
    // act on what Mark asks (reopen, close-by-name, or a scan via the reviewTabs tool).
    const tabs = await chrome.tabs.query({});
    const openTabs = tabs
      .filter(t => t.url && !/^(chrome|edge|about|chrome-extension):/.test(t.url))
      .map(t => ({ id: t.id, title: t.title, url: t.url }));
    const { micDeviceId } = await chrome.storage.local.get("micDeviceId"); // offscreen has no chrome.storage
    chrome.runtime.sendMessage({ type: "START_VOICE", openTabs, backendUrl: BACKEND_URL, micDeviceId });
    send({ ok: true });
  })();
  return true;
});

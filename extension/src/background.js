import { installIdleWatcher } from "./idle-watcher.js";
import { gatherCandidates } from "./tabs-io.js";

console.log("Tabby background loaded");

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg === "DEBUG_GATHER") { gatherCandidates().then(send); return true; }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

installIdleWatcher();

import { installIdleWatcher } from "./idle-watcher.js";

console.log("Tabby background loaded");

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

installIdleWatcher();

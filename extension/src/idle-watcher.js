import { setTabActive } from "./store.js";

export function installIdleWatcher() {
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
      const tab = await chrome.tabs.get(tabId);
      await setTabActive(tabId, { url: tab.url, title: tab.title });
    } catch { /* tab gone */ }
  });
}

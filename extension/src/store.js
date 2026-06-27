const TAB_STATE = "tabState";   // { [tabId]: { url, title, lastActiveAt } }
const CLOSED_LOG = "closedLog";  // [ { url, title, description, keywords, closedAt } ]

export async function getTabState() {
  return (await chrome.storage.local.get(TAB_STATE))[TAB_STATE] ?? {};
}
export async function setTabActive(tabId, { url, title }) {
  const s = await getTabState();
  s[tabId] = { url, title, lastActiveAt: Date.now() };
  await chrome.storage.local.set({ [TAB_STATE]: s });
}
export async function getClosedLog() {
  return (await chrome.storage.local.get(CLOSED_LOG))[CLOSED_LOG] ?? [];
}
export async function appendClosed(record) {
  const log = await getClosedLog();
  log.unshift(record);
  await chrome.storage.local.set({ [CLOSED_LOG]: log });
}
export async function removeClosed(url) {
  const log = (await getClosedLog()).filter(r => r.url !== url);
  await chrome.storage.local.set({ [CLOSED_LOG]: log });
}

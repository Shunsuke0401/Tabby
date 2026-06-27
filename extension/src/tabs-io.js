import { selectCandidates } from "./candidates.js";
import { IDLE_THRESHOLD_MINUTES } from "./config.js";
import { appendClosed, removeClosed } from "./store.js";

export async function readTabText(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body?.innerText?.slice(0, 2000) ?? "",
    });
    return result ?? "";
  } catch { return ""; } // chrome://, web store, etc.
}

export async function gatherCandidates() {
  const tabs = await chrome.tabs.query({});
  const candidates = selectCandidates(tabs, Date.now(), IDLE_THRESHOLD_MINUTES);
  for (const c of candidates) c.text = await readTabText(c.id);
  return candidates;
}

export async function closeAndRecord(result, candidate) {
  await appendClosed({
    url: candidate.url,
    title: candidate.title,
    description: result.description,
    keywords: result.keywords,
    closedAt: Date.now(),
  });
  try { await chrome.tabs.remove(candidate.id); } catch { /* already gone */ }
}

export async function reopen(url) {
  await chrome.tabs.create({ url });
  await removeClosed(url);
}

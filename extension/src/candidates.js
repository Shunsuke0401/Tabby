const SKIP_PREFIXES = ["chrome://", "chrome-extension://", "edge://", "about:"];

export function selectCandidates(tabs, nowMs, thresholdMinutes) {
  return tabs
    .filter(t => !t.active && !t.pinned)
    .filter(t => t.url && !SKIP_PREFIXES.some(p => t.url.startsWith(p)))
    .map(t => ({
      id: t.id,
      title: t.title ?? "",
      url: t.url,
      idleMinutes: Math.floor((nowMs - (t.lastAccessed ?? nowMs)) / 60000),
    }))
    .filter(c => c.idleMinutes >= thresholdMinutes)
    .sort((a, b) => b.idleMinutes - a.idleMinutes);
}

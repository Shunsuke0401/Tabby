export function buildClassifyPrompt(tabs) {
  const list = tabs.map(t =>
    `- id:${t.id} | idle:${t.idleMinutes}min | title:${t.title} | url:${t.url}\n  text:${(t.text || "").slice(0, 1200)}`
  ).join("\n");
  return `You are an autonomous tab-triage agent. For each tab decide:
- bucket: "finished" (read/done), "parked-intent" (an unfinished task to return to: a flight being compared, a half-filled form, a cart, a draft), or "reference" (docs/tools used repeatedly).
- action: "auto-close" ONLY when highly confident the tab is dead and low-stakes (error pages, completed checkouts, fully-read articles idle for hours, stale searches, duplicates); "suggest" when it looks finished but closing might surprise the user; "keep" otherwise.
- confidence: "high" | "medium" | "low".
- reason: one short human sentence.
- description: a short phrase of what the site is (e.g. "online store for buying books").
- keywords: 3-6 lowercase tags.

You must NEVER auto-close a "parked-intent" or "reference" tab. When in doubt, downgrade auto-close -> suggest -> keep.

Tabs:
${list}`;
}

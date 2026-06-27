const BUCKETS = ["finished", "parked-intent", "reference"];
const ACTIONS = ["auto-close", "suggest", "keep"];

export function parseClassifyResponse(text) {
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  const results = Array.isArray(data?.results) ? data.results : [];
  return results
    .filter(r => Number.isInteger(r?.id))
    .map(r => {
      const bucket = BUCKETS.includes(r.bucket) ? r.bucket : "reference";
      let action = ACTIONS.includes(r.action) ? r.action : "keep";
      if (action === "auto-close" && bucket !== "finished") action = "suggest";
      return {
        id: r.id, bucket, action,
        confidence: ["high", "medium", "low"].includes(r.confidence) ? r.confidence : "low",
        reason: String(r.reason ?? ""),
        description: String(r.description ?? ""),
        keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [],
      };
    });
}

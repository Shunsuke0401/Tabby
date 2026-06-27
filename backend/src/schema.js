export const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          bucket: { type: "string", enum: ["finished", "parked-intent", "reference"] },
          action: { type: "string", enum: ["auto-close", "suggest", "keep"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          reason: { type: "string" },
          description: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
        },
        required: ["id", "bucket", "action", "confidence", "reason", "description", "keywords"],
      },
    },
  },
  required: ["results"],
};

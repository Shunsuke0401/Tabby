import { describe, it, expect } from "vitest";
import { parseClassifyResponse, parseMatchResponse } from "../src/parse.js";

describe("parseClassifyResponse", () => {
  it("parses valid JSON results", () => {
    const out = parseClassifyResponse(JSON.stringify({ results: [
      { id: 1, bucket: "finished", action: "auto-close", confidence: "high", reason: "done", description: "d", keywords: ["a"] },
    ]}));
    expect(out[0].action).toBe("auto-close");
  });

  it("downgrades auto-close to suggest for parked-intent/reference", () => {
    const out = parseClassifyResponse(JSON.stringify({ results: [
      { id: 2, bucket: "parked-intent", action: "auto-close", confidence: "high", reason: "flight", description: "d", keywords: [] },
    ]}));
    expect(out[0].action).toBe("suggest");
  });

  it("returns [] on malformed JSON", () => {
    expect(parseClassifyResponse("not json")).toEqual([]);
  });
});

it("parseMatchResponse returns the chosen url or null", () => {
  expect(parseMatchResponse(JSON.stringify({ url: "https://amazon.com" })).url).toBe("https://amazon.com");
  expect(parseMatchResponse(JSON.stringify({ url: null })).url).toBeNull();
  expect(parseMatchResponse("garbage").url).toBeNull();
});

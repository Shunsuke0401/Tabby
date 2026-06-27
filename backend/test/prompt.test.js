import { describe, it, expect } from "vitest";
import { buildClassifyPrompt, buildMatchPrompt } from "../src/prompt.js";

describe("buildClassifyPrompt", () => {
  it("includes the conservative rule and each tab's id/title/url/idle", () => {
    const p = buildClassifyPrompt([{ id: 7, title: "Amazon", url: "https://amazon.com", idleMinutes: 300, text: "buy books" }]);
    expect(p).toMatch(/never .*auto-close/i);
    expect(p).toContain("7");
    expect(p).toContain("https://amazon.com");
    expect(p).toContain("300");
  });
});

it("buildMatchPrompt includes the query and candidate urls", () => {
  const p = buildMatchPrompt("the site to buy books", [{ url: "https://amazon.com", description: "buy books", keywords: ["books"] }]);
  expect(p).toContain("the site to buy books");
  expect(p).toContain("https://amazon.com");
});

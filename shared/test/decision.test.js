import { describe, it, expect } from "vitest";
import { splitByAction } from "../../extension/src/decision.js";

describe("splitByAction", () => {
  it("buckets results and defends against unsafe auto-close", () => {
    const out = splitByAction([
      { id: 1, bucket: "finished", action: "auto-close", confidence: "high" },
      { id: 2, bucket: "reference", action: "auto-close", confidence: "high" }, // unsafe -> suggest
      { id: 3, bucket: "finished", action: "suggest", confidence: "medium" },
      { id: 4, bucket: "reference", action: "keep", confidence: "low" },
    ]);
    expect(out.autoClose.map(r => r.id)).toEqual([1]);
    expect(out.suggest.map(r => r.id).sort()).toEqual([2, 3]);
    expect(out.keep.map(r => r.id)).toEqual([4]);
  });
});

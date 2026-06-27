import { describe, it, expect } from "vitest";
import { selectCandidates } from "../../extension/src/candidates.js";

const MIN = 60000;
const now = 1_000_000_000_000;

describe("selectCandidates", () => {
  it("returns tabs idle beyond the threshold, sorted by idle desc", () => {
    const tabs = [
      { id: 1, title: "Fresh",  url: "https://a.com", lastAccessed: now - 5 * MIN,  active: false, pinned: false },
      { id: 2, title: "Stale",  url: "https://b.com", lastAccessed: now - 120 * MIN, active: false, pinned: false },
      { id: 3, title: "Old",    url: "https://c.com", lastAccessed: now - 90 * MIN,  active: false, pinned: false },
    ];
    const out = selectCandidates(tabs, now, 60);
    expect(out.map(c => c.id)).toEqual([2, 3]);
    expect(out[0].idleMinutes).toBe(120);
  });

  it("excludes active, pinned, and chrome:// tabs", () => {
    const tabs = [
      { id: 1, title: "Active",  url: "https://a.com",  lastAccessed: now - 200 * MIN, active: true,  pinned: false },
      { id: 2, title: "Pinned",  url: "https://b.com",  lastAccessed: now - 200 * MIN, active: false, pinned: true  },
      { id: 3, title: "Chrome",  url: "chrome://newtab",lastAccessed: now - 200 * MIN, active: false, pinned: false },
    ];
    expect(selectCandidates(tabs, now, 60)).toEqual([]);
  });
});

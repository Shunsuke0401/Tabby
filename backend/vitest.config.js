import { defineConfig } from "vitest/config";

// Scope backend test discovery to backend/test so the root config
// (which targets shared/test) doesn't shadow it.
export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
  },
});

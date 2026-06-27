import { defineConfig } from "vitest/config";

// Root test run covers the pure shared/extension logic.
// The backend has its own package.json + test script (cd backend && npm test).
export default defineConfig({
  test: {
    include: ["shared/test/**/*.test.js"],
  },
});

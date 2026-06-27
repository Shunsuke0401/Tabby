// Single source of truth for tunables. Swap BACKEND_URL after Cloud Run deploy (Task 4).
// export const BACKEND_URL = "http://localhost:8080"; // local dev
export const BACKEND_URL = "https://tabby-backend-701786321717.asia-northeast1.run.app";
export const IDLE_THRESHOLD_MINUTES = 60; // tabs idle longer than this become candidates
export const REVIEW_ALARM_MINUTES = 60;   // proactive scan interval

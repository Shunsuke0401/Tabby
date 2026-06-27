import { BACKEND_URL } from "./config.js";

export async function classify(candidates) {
  const res = await fetch(`${BACKEND_URL}/classify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tabs: candidates }),
  });
  const data = await res.json();
  return data.results ?? [];
}

export async function matchClosed(query) {
  const records = await chrome.runtime.sendMessage("GET_CLOSED");
  const res = await fetch(`${BACKEND_URL}/match`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, records }),
  });
  return (await res.json()).url ?? null;
}

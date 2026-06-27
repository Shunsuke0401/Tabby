import { matchClosed } from "../src/api.js";

async function refreshCount() {
  const tabs = await chrome.tabs.query({});
  document.getElementById("count").textContent = `${tabs.length} tabs`;
}
refreshCount();
chrome.tabs.onCreated.addListener(refreshCount);
chrome.tabs.onRemoved.addListener(refreshCount);

const $ = id => document.getElementById(id);

function row(text, btnLabel, onClick) {
  const li = document.createElement("li");
  li.textContent = text + " ";
  if (btnLabel) { const b = document.createElement("button"); b.textContent = btnLabel; b.onclick = onClick; li.appendChild(b); }
  return li;
}

async function renderClosed() {
  const log = await chrome.runtime.sendMessage("GET_CLOSED");
  $("closedList").replaceChildren(...log.map(r =>
    row(`${r.title} — ${r.description}`, "Reopen",
      async () => { await chrome.runtime.sendMessage({ type: "REOPEN", url: r.url }); renderClosed(); })));
}

$("reviewNow").onclick = async () => {
  $("reviewNow").textContent = "Thinking…";
  const { autoClosed, suggest } = await chrome.runtime.sendMessage("REVIEW_NOW");
  $("autoClosedList").replaceChildren(...autoClosed.map(r => row(`${r.title} — ${r.reason}`)));
  $("suggestList").replaceChildren(...suggest.map(r =>
    row(`${r.title} — ${r.reason}`, "Close",
      async (e) => { e.target.disabled = true;
        await chrome.runtime.sendMessage({ type: "CLOSE_ONE", id: r.id, description: r.description, keywords: r.keywords });
        renderClosed(); })));
  $("reviewNow").textContent = "Review now";
  renderClosed();
};
renderClosed();

$("reopenQuery").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter" || !e.target.value.trim()) return;
  const url = await matchClosed(e.target.value.trim());
  if (url) { await chrome.runtime.sendMessage({ type: "REOPEN", url }); e.target.value = ""; renderClosed(); }
  else { e.target.placeholder = "couldn't find that one — try describing it differently"; }
});

const talkBtn = document.createElement("button");
talkBtn.textContent = "🎙️ Talk to Tabby";
talkBtn.onclick = () => chrome.runtime.sendMessage("TALK");
document.querySelector("header").appendChild(talkBtn);

const voiceStatus = document.createElement("span");
voiceStatus.id = "voiceStatus";
document.querySelector("header").appendChild(voiceStatus);

const STATE_LABEL = {
  listening: "🎙️ listening",
  speaking: "🔊 Tabby speaking",
  error: "Voice unavailable — use the buttons.",
  idle: "",
};
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "VOICE_STATE") voiceStatus.textContent = STATE_LABEL[msg.state] ?? "";
});

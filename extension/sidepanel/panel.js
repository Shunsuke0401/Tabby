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
let voiceActive = false;
function setTalkButton(active) {
  voiceActive = active;
  talkBtn.textContent = active ? "⏹ Stop" : "🎙️ Talk to Tabby";
}
setTalkButton(false);
talkBtn.onclick = async () => {
  if (voiceActive) {                       // toggle off — end the session
    chrome.runtime.sendMessage("STOP_VOICE");
    setTalkButton(false);
    return;
  }
  // Side panels (and offscreen docs) can't display Chrome's mic prompt. If permission was
  // already granted, getUserMedia resolves silently and we proceed. If not, we open a normal
  // tab that CAN prompt; granting there persists the permission for the extension origin.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    populateMics(); // labels are available now that permission is granted
  } catch (e) {
    chrome.tabs.create({ url: chrome.runtime.getURL("mic-permission.html") });
    voiceStatus.textContent = "Opened a tab to enable your microphone — click Allow there, then press Talk again.";
    return;
  }
  chrome.runtime.sendMessage("TALK");
  setTalkButton(true);
};
document.querySelector("header").appendChild(talkBtn);

const voiceStatus = document.createElement("span");
voiceStatus.id = "voiceStatus";
document.querySelector("header").appendChild(voiceStatus);

const micLevel = document.createElement("div");
micLevel.id = "micLevel";
document.querySelector("header").appendChild(micLevel);

// Microphone picker — virtual devices (e.g. "Background Music") are often the OS default and
// capture no mic audio, so let the user choose the real one. Stored deviceId is read by offscreen.
const micPicker = document.createElement("select");
micPicker.id = "micPicker";
document.querySelector("header").appendChild(micPicker);

async function populateMics() {
  let devices = [];
  try { devices = await navigator.mediaDevices.enumerateDevices(); } catch { return; }
  const mics = devices.filter(d => d.kind === "audioinput");
  const stored = (await chrome.storage.local.get("micDeviceId")).micDeviceId;
  micPicker.replaceChildren(...mics.map((d, i) => {
    const o = document.createElement("option");
    o.value = d.deviceId;
    o.textContent = d.label || `Microphone ${i + 1}`;
    if (d.deviceId === stored) o.selected = true;
    return o;
  }));
}
micPicker.onchange = () => chrome.storage.local.set({ micDeviceId: micPicker.value });
populateMics();
navigator.mediaDevices.addEventListener?.("devicechange", populateMics);

const voiceDebug = document.createElement("div");
voiceDebug.id = "voiceDebug";
document.querySelector("header").appendChild(voiceDebug);

const voiceTranscript = document.createElement("div");
voiceTranscript.id = "voiceTranscript";
document.querySelector("header").appendChild(voiceTranscript);

let lastTranscriptRole = null;
function addTranscript(role, text) {
  if (role === lastTranscriptRole && voiceTranscript.firstElementChild) {
    voiceTranscript.firstElementChild.textContent += text;
  } else {
    const line = document.createElement("div");
    line.textContent = `${role === "user" ? "🗣️ You" : "🤖 Tabby"}: ${text}`;
    voiceTranscript.prepend(line);
    lastTranscriptRole = role;
  }
  while (voiceTranscript.childElementCount > 6) voiceTranscript.lastElementChild.remove();
}

const STATE_LABEL = {
  listening: "🎙️ listening",
  speaking: "🔊 Tabby speaking",
  error: "Voice unavailable — use the buttons.",
  idle: "",
};
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "VOICE_STATE") {
    const base = STATE_LABEL[msg.state] ?? "";
    voiceStatus.textContent = msg.detail ? `${base} [${msg.detail}]` : base;
    if (msg.state === "idle" || msg.state === "error") setTalkButton(false);
  }
  if (msg?.type === "VOICE_LEVEL") {
    const p = Math.min(1, msg.peak ?? 0);
    const bars = Math.round(p * 10);
    micLevel.textContent = `🎤 ${"█".repeat(bars)}${"░".repeat(10 - bars)} ${p.toFixed(2)}`;
  }
  if (msg?.type === "VOICE_DEBUG") {
    const line = document.createElement("div");
    line.textContent = `🔧 ${msg.text}`;
    voiceDebug.prepend(line);
    while (voiceDebug.childElementCount > 5) voiceDebug.lastElementChild.remove();
  }
  if (msg?.type === "VOICE_TRANSCRIPT") {
    addTranscript(msg.role, msg.text);
  }
});

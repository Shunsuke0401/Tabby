const $ = id => document.getElementById(id);

/* ───────── tab count ───────── */
async function refreshCount() {
  const tabs = await chrome.tabs.query({});
  $("count").textContent = `${tabs.length} tabs`;
}
refreshCount();
chrome.tabs.onCreated.addListener(refreshCount);
chrome.tabs.onRemoved.addListener(refreshCount);

/* ───────── active view + animated status word ───────── */
const activeView = $("activeView"), statusWord = $("statusWord"), transcriptEl = $("activeTranscript");
let statusLockUntil = 0;

function renderWord(word) {
  const len = word.length;
  statusWord.style.fontSize = len > 14 ? "15px" : len > 10 ? "18px" : "22px";
  statusWord.replaceChildren(...[...word].map((ch, i) => {
    const s = document.createElement("span");
    s.textContent = ch === " " ? " " : ch;
    s.style.animationDelay = `${i * 0.1}s`;
    return s;
  }));
}
function setStatus(word, lockMs = 0) {
  renderWord(word);
  if (lockMs) statusLockUntil = Date.now() + lockMs;
}
const isActive = () => !activeView.hidden;
function showActive(word) { setStatus(word); transcriptEl.textContent = ""; activeView.hidden = false; }
function showIdle() { activeView.hidden = true; transcriptEl.textContent = ""; statusLockUntil = 0; }

// reassemble streamed transcript chunks per speaker
let trRole = null, trText = "";
function showTranscript(role, text) {
  if (role !== trRole) { trRole = role; trText = ""; }
  trText += text;
  transcriptEl.textContent = `${role === "user" ? "🗣️ You" : "🤖 Tabby"}: ${trText}`;
}

const VOICE_STATE_WORD = { listening: "Listening", speaking: "Suggesting" };

/* ───────── Start / End the voice assistant ───────── */
$("startBtn").onclick = async () => {
  // The panel can't show Chrome's mic prompt; if not yet granted, open a tab that can.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    populateMics();
  } catch {
    chrome.tabs.create({ url: chrome.runtime.getURL("mic-permission.html") });
    return;
  }
  chrome.runtime.sendMessage("TALK");
  showActive("Listening");
};
$("endBtn").onclick = () => { chrome.runtime.sendMessage("STOP_VOICE"); showIdle(); };

/* ───────── microphone picker (icon → menu) ───────── */
$("micBtn").onclick = () => {
  const menu = $("micMenu");
  menu.hidden = !menu.hidden;
  if (!menu.hidden) populateMics();
};
async function populateMics() {
  let devices = [];
  try { devices = await navigator.mediaDevices.enumerateDevices(); } catch { return; }
  const mics = devices.filter(d => d.kind === "audioinput");
  const stored = (await chrome.storage.local.get("micDeviceId")).micDeviceId;
  $("micPicker").replaceChildren(...mics.map((d, i) => {
    const o = document.createElement("option");
    o.value = d.deviceId;
    o.textContent = d.label || `Microphone ${i + 1}`;
    if (d.deviceId === stored) o.selected = true;
    return o;
  }));
}
$("micPicker").onchange = () => chrome.storage.local.set({ micDeviceId: $("micPicker").value });
populateMics();
navigator.mediaDevices.addEventListener?.("devicechange", populateMics);

/* ───────── live status from the agent ───────── */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "VOICE_STATE") {
    if (msg.state === "idle") showIdle();
    else if (msg.state === "error") {
      setStatus("Error");
      transcriptEl.textContent = msg.detail || "Voice unavailable";
      setTimeout(showIdle, 2600);
    } else if (isActive() && Date.now() >= statusLockUntil && VOICE_STATE_WORD[msg.state]) {
      setStatus(VOICE_STATE_WORD[msg.state]);
    }
  }
  if (msg?.type === "STATUS" && msg.value && isActive()) {
    const lock = (msg.value === "Closed" || msg.value.startsWith("Reopening")) ? 1600 : 0;
    setStatus(msg.value, lock);
  }
  if (msg?.type === "VOICE_TRANSCRIPT" && isActive()) showTranscript(msg.role, msg.text);
});

const statusEl = document.getElementById("status");

async function grant() {
  statusEl.textContent = "Requesting microphone…";
  statusEl.className = "";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop()); // we only needed the permission grant
    statusEl.textContent = "✅ Microphone enabled! Close this tab and click “🎙️ Talk to Tabby”.";
    statusEl.className = "ok";
  } catch (e) {
    statusEl.textContent = `❌ ${e?.name ?? ""}: ${e?.message ?? e}. Click “Enable microphone” and choose Allow.`;
    statusEl.className = "err";
  }
}

document.getElementById("grant").onclick = grant;
// Also attempt immediately — opening this page in a tab is enough of a context for Chrome to prompt.
grant();

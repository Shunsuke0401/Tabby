import { downsampleToPCM16, pcm16ToFloat32 } from "./audio.js";
import { connectLive } from "./live.js";

let audioCtx, micStream, micSrc, micProc, session;
let playHead = 0;        // schedule incoming audio chunks back-to-back
let speakTimer;
let lastState = "";

function setState(state, detail) {
  if (state === lastState && !detail) return;
  lastState = state;
  chrome.runtime.sendMessage({ type: "VOICE_STATE", state, detail });
}

// Tear down any active session + mic so we never run two at once (overlap kills input).
function teardown() {
  try { session?.close(); } catch {}
  session = null;
  try { if (micProc) { micProc.onaudioprocess = null; micProc.disconnect(); } } catch {}
  try { micSrc?.disconnect(); } catch {}
  try { micStream?.getTracks().forEach(t => t.stop()); } catch {}
  micProc = micSrc = micStream = null;
}

async function startMic(onChunk, deviceId) {
  const base = { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { ...base, deviceId: { exact: deviceId } } : base,
    });
  } catch (e) {
    // Chosen device unavailable — fall back to the system default rather than failing.
    micStream = await navigator.mediaDevices.getUserMedia({ audio: base });
  }
  audioCtx = audioCtx ?? new AudioContext();
  if (audioCtx.state === "suspended") await audioCtx.resume();
  // Diagnostics: surface exactly what we captured (device, muted, live) + context state.
  const track = micStream.getAudioTracks()[0];
  chrome.runtime.sendMessage({ type: "VOICE_DEBUG",
    text: `mic="${track?.label || "?"}" muted=${track?.muted} enabled=${track?.enabled} state=${track?.readyState} | ctx=${audioCtx.state} ${audioCtx.sampleRate}Hz` });
  micSrc = audioCtx.createMediaStreamSource(micStream);
  micProc = audioCtx.createScriptProcessor(4096, 1, 1); // simple + reliable for a demo
  let n = 0, windowPeak = 0;
  micProc.onaudioprocess = (e) => {
    const ch = e.inputBuffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a; }
    if (peak > windowPeak) windowPeak = peak;
    if (++n % 12 === 0) { chrome.runtime.sendMessage({ type: "VOICE_LEVEL", peak: windowPeak }); windowPeak = 0; } // ~1/sec
    onChunk(downsampleToPCM16(ch, audioCtx.sampleRate, 16000));
  };
  // Keep the processor running without routing the mic back to the speakers (avoids feedback).
  const sink = audioCtx.createGain(); sink.gain.value = 0;
  micSrc.connect(micProc); micProc.connect(sink); sink.connect(audioCtx.destination);
  // Watchdog: if the processor never fires, the context isn't actually running.
  setTimeout(() => {
    if (n === 0) chrome.runtime.sendMessage({ type: "VOICE_DEBUG", text: `⚠️ no audio frames after 2.5s (ctx=${audioCtx.state})` });
  }, 2500);
}

// Live returns base64 PCM16 @ 24kHz; schedule chunks sequentially so they don't overlap.
function playPCM(base64) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const buf = audioCtx.createBuffer(1, int16.length, 24000);
  buf.getChannelData(0).set(pcm16ToFloat32(int16));
  const node = audioCtx.createBufferSource(); node.buffer = buf; node.connect(audioCtx.destination);
  playHead = Math.max(playHead, audioCtx.currentTime);
  node.start(playHead);
  playHead += buf.duration;
  setState("speaking");
  clearTimeout(speakTimer);
  speakTimer = setTimeout(() => setState("listening"), (playHead - audioCtx.currentTime) * 1000 + 150);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "START_VOICE") { startVoice(msg); return; }
  if (msg === "STOP_VOICE") { teardown(); setState("idle"); return; }
  if (msg?.type === "VOICE_TOOL_RESULT" && session) { session.toolResponse(msg.id, msg.name, msg.result); }
});

async function startVoice(msg) {
  teardown();        // never overlap sessions
  playHead = 0;
  try {
    audioCtx = audioCtx ?? new AudioContext();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const { token, model } = await fetch(`${msg.backendUrl}/live-token`, { method: "POST" }).then(r => r.json());
    if (!token || !model) throw new Error("no live token");
    session = await connectLive({
      token,
      model,
      onAudio: playPCM,
      onToolCall: (c) => {
        console.log("[Tabby] model toolCall:", c?.name, JSON.stringify(c?.args), "id:", c?.id);
        chrome.runtime.sendMessage({ type: "VOICE_TOOL", call: c });
      },
      onTranscript: (t) => chrome.runtime.sendMessage({ type: "VOICE_TRANSCRIPT", role: t.role, text: t.text }),
      // Surface the close reason (e.g. depleted credits) and stop the mic so we don't keep
      // sending into a dead socket ("WebSocket already CLOSED" spam).
      onError: (e) => { teardown(); setState("error", String(e?.message ?? e)); },
      onClose: (e) => { const reason = e?.reason; teardown(); setState(reason ? "error" : "idle", reason || undefined); },
    });
    let micChunks = 0;
    await startMic((int16) => {
      session.sendAudio(int16);
      if (++micChunks === 1) chrome.runtime.sendMessage({ type: "VOICE_DEBUG", text: "🎤 mic streaming…" });
    }, msg.micDeviceId);
    setState("listening");
    session.sendContext(
      `Mark's currently open tabs (id, title, url): ${JSON.stringify(msg.openTabs ?? [])}.\n` +
      `Greet Mark briefly and ask how you can help, then wait for his request. Do not scan or close anything yet.`
    );
  } catch (e) {
    console.error("startVoice failed", e);
    setState("error", String(e?.name ? e.name + ": " : "") + String(e?.message ?? e));
  }
}

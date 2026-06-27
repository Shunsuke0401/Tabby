import { downsampleToPCM16, pcm16ToFloat32 } from "./audio.js";
import { connectLive } from "./live.js";

let audioCtx, micStream, session;
let playHead = 0;        // schedule incoming audio chunks back-to-back
let speakTimer;
let lastState = "";

function setState(state, detail) {
  if (state === lastState && !detail) return;
  lastState = state;
  chrome.runtime.sendMessage({ type: "VOICE_STATE", state, detail });
}

async function startMic(onChunk) {
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
  audioCtx = audioCtx ?? new AudioContext();
  const src = audioCtx.createMediaStreamSource(micStream);
  const proc = audioCtx.createScriptProcessor(4096, 1, 1); // simple + reliable for a demo
  proc.onaudioprocess = (e) => onChunk(downsampleToPCM16(e.inputBuffer.getChannelData(0), audioCtx.sampleRate, 16000));
  // Keep the processor running without routing the mic back to the speakers (avoids feedback).
  const sink = audioCtx.createGain(); sink.gain.value = 0;
  src.connect(proc); proc.connect(sink); sink.connect(audioCtx.destination);
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
  if (msg?.type === "START_VOICE") {
    startVoice(msg);
    return;
  }
  if (msg?.type === "VOICE_TOOL_RESULT" && session) {
    session.toolResponse(msg.id, msg.name, msg.result);
  }
});

async function startVoice(msg) {
  try {
    audioCtx = audioCtx ?? new AudioContext();
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
      onError: (e) => setState("error", String(e?.message ?? e)),
      onClose: () => setState("idle"),
    });
    let micChunks = 0;
    await startMic((int16) => {
      session.sendAudio(int16);
      if (++micChunks === 1) chrome.runtime.sendMessage({ type: "VOICE_DEBUG", text: "🎤 mic streaming…" });
    });
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

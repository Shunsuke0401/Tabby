import { downsampleToPCM16 } from "./audio.js";

let audioCtx, micStream, session;

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
// session wiring added in Task 5

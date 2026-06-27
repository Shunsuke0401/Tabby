import { GoogleGenAI, Modality } from "../vendor/genai.js";
import { pcm16ToBase64 } from "./audio.js";

// The model + persona + tools are all locked inside the ephemeral token (minted by the
// backend), so the client passes only the token and the model id it was given.
export async function connectLive({ token, model, onAudio, onToolCall, onTranscript, onError, onClose, onOpen }) {
  const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });
  const session = await ai.live.connect({
    model,
    config: { responseModalities: [Modality.AUDIO] }, // systemInstruction + tools come from the token's locked config
    callbacks: {
      onopen: () => onOpen?.(),
      onmessage: (message) => {
        const sc = message.serverContent;
        // Audio out: base64 PCM16 @ 24kHz arrives in serverContent.modelTurn.parts[].inlineData.
        const parts = sc?.modelTurn?.parts || [];
        for (const p of parts) {
          const data = p.inlineData?.data;
          if (data) onAudio(data);
        }
        // Transcriptions (enabled in the token's config) — prove the audio pipeline works.
        if (sc?.inputTranscription?.text) onTranscript?.({ role: "user", text: sc.inputTranscription.text });
        if (sc?.outputTranscription?.text) onTranscript?.({ role: "tabby", text: sc.outputTranscription.text });
        const calls = message.toolCall?.functionCalls;
        if (calls) for (const c of calls) onToolCall(c); // { id, name, args }
      },
      onerror: (e) => { console.error("Live error", e?.message ?? e); onError?.(e); },
      onclose: (e) => onClose?.(e),
    },
  });
  return {
    // Live wants base64 little-endian PCM16 @ 16kHz, not a raw Int16Array.
    sendAudio: (int16) => session.sendRealtimeInput({ audio: { data: pcm16ToBase64(int16), mimeType: "audio/pcm;rate=16000" } }),
    sendContext: (text) => session.sendClientContent({ turns: text, turnComplete: true }),
    toolResponse: (id, name, result) => session.sendToolResponse({ functionResponses: [{ id, name, response: result }] }),
    close: () => session.close(),
    raw: session,
  };
}

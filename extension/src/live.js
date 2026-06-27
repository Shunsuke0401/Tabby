import { GoogleGenAI, Modality } from "../vendor/genai.js";
import { pcm16ToBase64 } from "./audio.js";

// Verified against the live models list for this key; half-cascade = reliable function-calling.
export const LIVE_MODEL = "gemini-3.1-flash-live-preview";

export const TABBY_SYSTEM_PROMPT = `You are Tabby, a warm, concise browser-tab assistant. You address the user as "Mark".
You are given a list of tabs you proposed closing. Speak a short, friendly suggestion naming a few of them
and asking if Mark wants them closed. Then listen. Based on his reply, call tools:
- closeTabs(ids) for the ones he approves,
- keepTabs(ids) for ones he wants to keep,
- reopenTab(query) when he asks to bring something back (match his description to the closed list).
Keep speech natural and brief. Confirm what you did after acting.`;

export const TOOL_DECLS = [{
  functionDeclarations: [
    { name: "closeTabs", description: "Close the tabs with these ids",
      parameters: { type: "object", properties: { ids: { type: "array", items: { type: "integer" } } }, required: ["ids"] } },
    { name: "keepTabs", description: "Keep (do not close) the tabs with these ids",
      parameters: { type: "object", properties: { ids: { type: "array", items: { type: "integer" } } }, required: ["ids"] } },
    { name: "reopenTab", description: "Reopen a previously closed tab matching the user's description",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  ],
}];

export async function connectLive({ token, onAudio, onToolCall, onError, onClose, onOpen }) {
  // The ephemeral token is used as the apiKey; Live lives on the v1alpha surface.
  const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });
  const session = await ai.live.connect({
    model: LIVE_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: TABBY_SYSTEM_PROMPT,
      tools: TOOL_DECLS,
    },
    callbacks: {
      onopen: () => onOpen?.(),
      onmessage: (message) => {
        // Audio out: base64 PCM16 @ 24kHz arrives in serverContent.modelTurn.parts[].inlineData.
        const parts = message.serverContent?.modelTurn?.parts || [];
        for (const p of parts) {
          const data = p.inlineData?.data;
          if (data) onAudio(data);
        }
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

import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// Ephemeral tokens live under the v1alpha API surface.
const aiLive = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1alpha" } });

// The Live voice model the extension connects to. The half-cascade gemini-3.1-flash-live-preview
// currently returns "Internal error" on connect; this native-audio model is verified working
// (real audio output + reliable function-calling) against this key.
export const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

// Tabby's voice persona — locked into the ephemeral token so the client can't tamper with it.
const TABBY_SYSTEM_PROMPT = `You are Tabby, a warm, concise VOICE ASSISTANT for managing "Mark"'s browser tabs.
At the start you are given Mark's CURRENTLY OPEN tabs (each with a numeric id, title, url).
Greet Mark briefly and ask how you can help — then WAIT and listen. Do NOT scan or close anything until he asks.

What Mark might ask, and what to do:
- Reopen a tab he describes (e.g. "do you remember the site where I buy books?" → reopen it): call reopenTab(query) with his description. No scan needed.
- Close specific open tabs he names (e.g. "close the ChatGPT tab", "close YouTube"): call closeTabs(ids), matching his words to ids from the open-tabs list. ALWAYS pass numeric ids, never titles.
- Tidy up / "scan my tabs" / "close the ones I don't need": call reviewTabs(). It scans all open tabs, auto-closes the ones that are clearly done/dead, and returns what it closed plus borderline ones. Then tell Mark what you closed and ask about the borderline ones; if he approves, call closeTabs for those.
- keepTabs(ids): keep tabs (do nothing) — use when he says to leave some alone.

When Mark approves an action, CALL the matching tool — do not just say you will. Keep speech short and natural, and confirm out loud what you did.`;

// Function declarations use the uppercase Type enum. These MUST be locked into the token:
// a model-only constraint strips client-supplied tools and the model never calls them.
const TABBY_TOOLS = [{
  functionDeclarations: [
    { name: "closeTabs", description: "Close the tabs with these ids",
      parameters: { type: "OBJECT", properties: { ids: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["ids"] } },
    { name: "keepTabs", description: "Keep (do not close) the tabs with these ids",
      parameters: { type: "OBJECT", properties: { ids: { type: "ARRAY", items: { type: "INTEGER" } } }, required: ["ids"] } },
    { name: "reopenTab", description: "Reopen a previously closed tab matching the user's description",
      parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
    { name: "reviewTabs", description: "Scan all of Mark's open tabs, automatically close the ones clearly done or dead (error pages, finished articles, stale searches, duplicates), and return what was closed plus borderline tabs to ask about. Call this only when Mark asks to scan, tidy, clean up, or close unnecessary tabs.",
      parameters: { type: "OBJECT", properties: {} } },
  ],
}];

export async function generateJson(prompt, schema) {
  const res = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  return res.text;
}

// Mints a short-lived token with the entire Live config LOCKED inside it: the API key never
// reaches the client, and locking the tools/persona is what makes voice tool-calls actually fire.
export async function createLiveToken() {
  const token = await aiLive.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: LIVE_MODEL,
        config: {
          responseModalities: ["AUDIO"],
          systemInstruction: TABBY_SYSTEM_PROMPT,
          tools: TABBY_TOOLS,
          inputAudioTranscription: {},   // transcribe Mark's speech (so the UI can show it)
          outputAudioTranscription: {},  // transcribe Tabby's speech
        },
      },
      httpOptions: { apiVersion: "v1alpha" },
    },
  });
  return token.name;
}

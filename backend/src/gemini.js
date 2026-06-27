import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// Ephemeral tokens live under the v1alpha API surface.
const aiLive = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1alpha" } });

// The Live voice model the extension connects to. The half-cascade gemini-3.1-flash-live-preview
// currently returns "Internal error" on connect; this native-audio model is verified working
// (real audio output + reliable function-calling) against this key.
export const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

// Tabby's voice persona — locked into the ephemeral token so the client can't tamper with it.
const TABBY_SYSTEM_PROMPT = `You are Tabby, a warm, concise browser-tab assistant. You address the user as "Mark".
You are given a list of tabs you proposed closing. Speak a short, friendly suggestion naming a few of them
and asking if Mark wants them closed. Then listen. Based on his reply, call tools:
- closeTabs(ids) for the ones he approves,
- keepTabs(ids) for ones he wants to keep,
- reopenTab(query) when he asks to bring something back (match his description to the closed list).
Keep speech natural and brief. Confirm what you did after acting.`;

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
        },
      },
      httpOptions: { apiVersion: "v1alpha" },
    },
  });
  return token.name;
}

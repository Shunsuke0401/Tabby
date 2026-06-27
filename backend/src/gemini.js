import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// Ephemeral tokens live under the v1alpha API surface.
const aiLive = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1alpha" } });

// The Live voice model the extension connects to (verified against the live models list).
export const LIVE_MODEL = "gemini-3.1-flash-live-preview";

export async function generateJson(prompt, schema) {
  const res = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  return res.text;
}

// Mints a short-lived token the extension uses to open the Live WebSocket,
// so the real GEMINI_API_KEY never reaches the client. Returns the token string.
export async function createLiveToken() {
  const token = await aiLive.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      liveConnectConstraints: { model: LIVE_MODEL },
      httpOptions: { apiVersion: "v1alpha" },
    },
  });
  return token.name;
}

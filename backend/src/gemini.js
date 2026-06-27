import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateJson(prompt, schema) {
  const res = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  return res.text;
}

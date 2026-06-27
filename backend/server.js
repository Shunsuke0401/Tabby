import express from "express";
import { buildClassifyPrompt, buildMatchPrompt } from "./src/prompt.js";
import { parseClassifyResponse, parseMatchResponse } from "./src/parse.js";
import { CLASSIFY_SCHEMA, MATCH_SCHEMA } from "./src/schema.js";
import { generateJson } from "./src/gemini.js";
const app = express();
app.use(express.json({ limit: "5mb" }));
app.use((_, res, next) => { res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type"); next(); });
app.options("*", (_, res) => res.sendStatus(204));

app.get("/health", (_, res) => res.json({ status: "ok" }));
app.get("/", (_, res) => res.send("<h1>Tabby</h1><p>The agent that closes tabs you stopped using — and never loses anything.</p>"));

app.post("/classify", async (req, res) => {
  const tabs = req.body?.tabs ?? [];
  if (!tabs.length) return res.json({ results: [] });
  try {
    const text = await generateJson(buildClassifyPrompt(tabs), CLASSIFY_SCHEMA);
    res.json({ results: parseClassifyResponse(text) });
  } catch (e) {
    console.error(e);
    res.status(502).json({ results: [], error: "classify_failed" });
  }
});

app.post("/match", async (req, res) => {
  const { query, records = [] } = req.body ?? {};
  if (!query || !records.length) return res.json({ url: null });
  try {
    const text = await generateJson(buildMatchPrompt(query, records), MATCH_SCHEMA);
    res.json(parseMatchResponse(text));
  } catch (e) { console.error(e); res.status(502).json({ url: null }); }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Tabby backend on :${port}`));

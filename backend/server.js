import express from "express";
const app = express();
app.use(express.json({ limit: "5mb" }));
app.use((_, res, next) => { res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type"); next(); });
app.options("*", (_, res) => res.sendStatus(204));

app.get("/health", (_, res) => res.json({ status: "ok" }));
app.get("/", (_, res) => res.send("<h1>Tabby</h1><p>The agent that closes tabs you stopped using — and never loses anything.</p>"));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Tabby backend on :${port}`));

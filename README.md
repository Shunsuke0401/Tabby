# 🐱 Tabby — the first agent that manages your tabs

Tabby is a voice-controlled AI agent that lives in your Chrome side panel. You talk to it, and it
manages your tabs for you: it scans your open tabs, auto-closes the ones that are clearly done,
asks about the borderline ones, and brings any closed tab back when you just *describe* it —
*"reopen the one about Atomic Habits."* Nothing is ever lost.

**Built for the AI Builders × Google Japan — Gemini AI Hackathon.**

🔗 **Live (deployed on Cloud Run):** https://tabby-backend-701786321717.asia-northeast1.run.app/

---

## 🎬 Demo

[![Watch the Tabby demo](https://img.youtube.com/vi/Id2ZtN5y96I/hqdefault.jpg)](https://youtu.be/Id2ZtN5y96I)

▶️ **https://youtu.be/Id2ZtN5y96I**

---

## What it does

- 🎙️ **Voice-first.** Press one button, then just talk. Tabby greets you and listens.
- 🧹 **"Clean up my tabs."** It reads your open tabs, classifies each one (finished / parked-intent /
  reference), auto-closes the obviously-dead ones, and asks before touching anything borderline.
- 🗣️ **Close by name.** *"Close the YouTube tab."* — it finds it and closes it.
- ↩️ **Reopen by memory.** *"Do you remember the site where I buy books? Open it."* — it matches your
  description against what it closed and brings it back. You never have to remember the URL.
- 🔒 **Nothing is lost.** Everything Tabby closes is recorded and one sentence away from coming back.

---

## 🟦 Google products used

Tabby is built end-to-end on Google's Gemini + Cloud stack. Every piece of intelligence is Gemini;
the whole thing is deployed and served from Cloud Run.

### 1. Gemini 3.5 Flash — the classification & matching brain
- **Tab triage (`POST /classify`):** for each idle tab (title, URL, page text), Gemini 3.5 Flash
  returns **structured JSON** — `{ bucket, action, confidence, reason, description, keywords }` —
  using `responseSchema` structured output. This is what decides *auto-close vs. ask vs. keep*.
- **Semantic reopen (`POST /match`):** given a natural-language description of a closed tab
  (*"the one about buying books"*), Gemini picks the single best closed tab to reopen — semantic
  recall with **no vector store**, because the closed-list fits entirely in Gemini's context.

### 2. Gemini Live API — the real-time voice agent
- Model: **`gemini-2.5-flash-native-audio-preview-12-2025`** (native-audio Live model).
- Real-time, bidirectional **audio in / audio out** — you speak, Tabby speaks back, over a WebSocket.
- **Function calling drives every action:** the model calls `closeTabs`, `keepTabs`, `reopenTab`,
  and `reviewTabs`, and the extension executes them. The conversation *is* the control surface.
- **Input + output transcription** so the UI can show what you said and what Tabby replied.

### 3. Google Cloud Run — the deployed backend + brain
- Serverless host for the Node/Express backend — this is the **submitted deployed link** and the
  page where you download the extension.
- **Keeps the Gemini API key server-side.** The extension never holds it; instead the backend mints
  short-lived **ephemeral tokens** (`POST /live-token`) so the browser can open the Gemini Live
  WebSocket securely.

---

## 🧠 How it works (the agent loop)

```
  CHROME EXTENSION  (senses + hands)              CLOUD RUN  (brain + deployed link)
  ┌──────────────────────────────┐               ┌───────────────────────────────┐
  │ side panel (voice UI)        │  POST /classify│  Gemini 3.5 Flash → buckets,  │
  │ service worker (orchestrator)│ ─────────────► │  actions, reasons, keywords   │
  │ reads tabs + page text       │  POST /match   │  Gemini 3.5 Flash → best       │
  │ closes / reopens tabs        │ ─────────────► │  closed tab for a description │
  │ offscreen doc (Live audio)   │  POST /live-token  → ephemeral token           │
  └──────────────┬───────────────┘               └───────────────────────────────┘
                 │ WebSocket (audio in / out, function calls)
                 ▼
        ┌────────────────────┐
        │  Gemini Live API   │  speaks suggestions, hears your reply,
        │  (native audio)    │  calls closeTabs / reopenTab / reviewTabs
        └────────────────────┘
```

1. **Talk** — press Start; the side panel shows an animated status orb and Tabby greets you.
2. **Ask** — *"clean up my tabs"* / *"close the YouTube tab"* / *"reopen the book one."*
3. **Reason** — Gemini 3.5 Flash classifies / matches; Gemini Live decides which tool to call.
4. **Act** — the extension closes / reopens the real tabs via Chrome APIs.
5. **Reassure** — everything closed is logged and reopenable by voice. Auto never means lost.

---

## 🚀 Try it

The fastest way is the deployed page — it has the demo video and a one-click download:

**https://tabby-backend-701786321717.asia-northeast1.run.app/**

Or install manually:

1. Download `tabby-extension.zip` from the page above (or zip the `extension/` folder) and unzip it.
2. Go to `chrome://extensions`, turn on **Developer mode** (top-right).
3. Click **Load unpacked** and pick the `extension/` folder. Open Tabby from the toolbar.
4. Pick your microphone (mic icon, top-right), press **🎙️ Start Tabby**, and talk.

The downloaded extension is pre-pointed at the deployed Cloud Run backend, so it works out of the
box — the Gemini API key stays server-side.

---

## 🛠️ Tech stack

| Layer | Tech |
|---|---|
| Extension | Chrome Manifest V3, vanilla JS (ES modules, no bundler), `chrome.offscreen` + Web Audio for Live audio |
| Backend | Node 20 + Express on **Google Cloud Run**, Docker |
| AI | **Gemini 3.5 Flash** (classify / match, structured JSON) · **Gemini Live API** native audio (voice + function calling) via `@google/genai` |
| State | `chrome.storage.local` (tab history + enriched closed-list) — no database, no vector store |

---

## 📁 Structure

```
extension/        Chrome MV3 extension (the product)
  ├── manifest.json
  ├── sidepanel/  voice-first side panel UI (animated status orb)
  ├── src/        background orchestrator, Gemini Live session, audio, tabs I/O
  └── offscreen.html / offscreen.js   hosts the Gemini Live audio session
backend/          Node + Express on Cloud Run (the brain + deployed link)
  ├── server.js   /classify · /match · /live-token · / (dashboard) · /download
  ├── src/        prompts, schemas, parsing, @google/genai wrapper
  └── public/     the deployed dashboard (hero, demo video, download)
```

---

Built with Gemini 3.5 Flash, Gemini Live, and Cloud Run.

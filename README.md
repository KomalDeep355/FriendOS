# FriendOS 🌼

**Your little thinking partner. It answers one question: "What should I do next?"**

FriendOS turns a messy brain dump into a calm, realistic priority plan, then tells you exactly what small step to take in the next 30 minutes. It only works with what you actually tell it. It does not invent tasks or deadlines.

**Demo:** https://friendos-rizl.onrender.com/
**Code:** https://github.com/KomalDeep355/FriendOS

---

## Why I built it

I built FriendOS for a friend who always has too many things to keep track of: assignments, errands, things to buy, things to clean. They didn't need another productivity dashboard. They already knew what was on their plate. The hard part was deciding **which thing to do right now**.

The problem isn't a lack of organization. It's decision overload.

```text
Too many things in my head
        ↓
Brain dump instead of forms
        ↓
AI prioritization instead of manual sorting
        ↓
NEXT 30 MINUTES instead of an overwhelming schedule
        ↓
A contextual action to help me actually start
```

---

## What it does

Type or speak something like:

> "I need to submit my assignment today, finish two sections, clean my room this weekend, and buy a charger because mine is damaged."

FriendOS returns:

- 🔥 **DO NOW**: tasks with an immediate deadline or a clear reason to go first
- 🌼 **DO SOON**: real tasks that matter but aren't urgent
- 🌿 **CAN WAIT**: real tasks that can safely happen later
- ⏱️ **NEXT 30 MINUTES**: 1 to 3 concrete steps that fit in half an hour

### Features

- **Brain-dump input.** No forms and no manual sorting.
- **Voice input.** Tap the mic, speak, tap again. Speech is transcribed with ElevenLabs Scribe v2 and organized automatically.
- **No invented tasks.** The prompt and a validation layer block made-up tasks, made-up deadlines, and duplicates.
- **Realistic NEXT 30.** Large tasks get a smaller first step instead of being crammed into 30 minutes.
- **Task completion.** Check tasks off. Progress is saved in the browser (`localStorage`).
- **Contextual actions.** Each task type gets a way to start:
  - Shopping: opens a Google Shopping search
  - Travel and research: opens a Google search
  - Email: builds a prompt, copies it, opens Gmail
  - Study: builds a study prompt and opens Gemini
  - Writing and cleaning: builds a step-by-step breakdown prompt
  - General: simple copy/start action
- **Languages.** English, Hindi, Punjabi, and Hinglish. User-facing text follows the selected language, while internal JSON keys stay in English so the UI stays stable.

> FriendOS has voice **input** (speech-to-text). It does not speak responses back.

---

## How it works

```text
Text or microphone
        ↓
Browser MediaRecorder (voice only)
        ↓
FastAPI  /api/transcribe  →  ElevenLabs Scribe v2
        ↓
FastAPI  /api/organize
        ↓
Open-weight Llama (OpenAI-compatible chat endpoint)
        ↓
Strict JSON plan → validation / normalization / de-duplication
        ↓
DO NOW · DO SOON · CAN WAIT · NEXT 30 MINUTES
        ↓
Contextual action
```

### Tech stack

| Layer | Tech |
|---|---|
| Frontend | HTML, CSS, JavaScript (no framework) |
| Backend | Python, FastAPI |
| AI | Open-weight Llama via an OpenAI-compatible API |
| Voice | ElevenLabs Scribe v2 (speech-to-text) |
| Storage | Browser `localStorage` (no database) |
| Hosting | Render |

### The AI layer and the anti-hallucination rules

The model gets the user's brain dump, the selected language, and a strict system prompt that says:

- only use tasks explicitly mentioned
- never invent deadlines, tasks, or events
- never duplicate tasks
- don't force tasks into categories (empty categories are fine)
- keep NEXT 30 realistic
- return valid JSON only

The backend doesn't trust the model blindly. `normalize_plan()` strips markdown fences, fills missing fields, removes empty or duplicate tasks, and drops any NEXT 30 item that points to a task that doesn't exist.

---

## Why open models matter here

FriendOS is built around an **open-weight Llama model** instead of being locked to one proprietary hosted model. Because the backend speaks the OpenAI-compatible chat format, the same code works with:

- **Fully local** via [Ollama](https://ollama.com): your notes never leave your machine (voice still uses ElevenLabs)
- **Hosted open-weight Llama** (for example Groq), which the public demo uses so anyone can try it without installing anything

Switching between them is two environment variables, not a rewrite.

---

## Run it locally

### 1. Clone and install

```powershell
git clone https://github.com/KomalDeep355/FriendOS.git
cd FriendOS
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

(macOS/Linux: `source .venv/bin/activate`)

### 2. Configure `.env`

**Option A: fully local with Ollama**

```bash
ollama pull llama3.2:3b
```

```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2:3b
ELEVENLABS_API_KEY=your_elevenlabs_key
```

**Option B: hosted Llama (Groq)**

```env
LLM_API_KEY=your_groq_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

The defaults are `https://api.groq.com/openai/v1` and `llama-3.3-70b-versatile`.

### 3. Start

```powershell
uvicorn main:app --reload
```

Open http://127.0.0.1:8000

### Try this

```text
I need to submit my assignment to my professor today. I still need to finish two sections. I also need to clean my room this weekend. I want to buy a new charger because mine is damaged.
```

Check that it doesn't invent tasks, duplicate the assignment, invent a deadline, or add research tasks.

---

## Deploy on Render

- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment variables:** `LLM_API_KEY`, `ELEVENLABS_API_KEY` (optionally `LLM_MODEL`, `LLM_BASE_URL`, `PYTHON_VERSION`)

Microphone recording needs HTTPS, which Render provides.

---

## Project structure

```text
FriendOS/
├── main.py                  # FastAPI app: /api/organize, /api/transcribe, JSON normalization
├── requirements.txt
├── prompts/
│   └── system_prompt.txt
├── static/
│   ├── index.html           # page structure
│   ├── style.css            # cozy, Pinterest-style board design
│   └── app.js               # API calls, rendering, voice recording, actions
├── .gitignore
└── README.md
```

---

## Known limitations

- Task completion is stored per browser (`localStorage`), so it doesn't sync across devices.
- Output quality depends on the model. Small local models can occasionally return weaker plans or invalid JSON.
- Voice input requires an ElevenLabs API key and an internet connection.
- No authentication or database. This is intentionally a small MVP.

## Possible future work

Text-to-speech replies, calendar integration, and cross-device sync. These are deliberately left out of the MVP so the core idea stays small and finished.

---

Built with care for a friend who just wanted to know what to do next. 🌼

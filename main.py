import os
import json
import re
from io import BytesIO

import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

app = FastAPI(title="FriendOS")

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def home():
    return FileResponse("static/index.html")


# ---------------------------------------------------------------------------
# LLM config (open-weight Llama through any OpenAI-compatible endpoint)
#
# Public demo (Render): Groq-hosted Llama
#   LLM_BASE_URL=https://api.groq.com/openai/v1   (default)
#   LLM_MODEL=llama-3.3-70b-versatile              (default)
#   LLM_API_KEY=<your Groq key>
#
# Fully local: Ollama
#   LLM_BASE_URL=http://localhost:11434/v1
#   LLM_MODEL=llama3.2:3b
#   (LLM_API_KEY can be empty)
# ---------------------------------------------------------------------------
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY", "")

elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")

if not elevenlabs_api_key:
    raise RuntimeError("ELEVENLABS_API_KEY is missing from .env")

elevenlabs = ElevenLabs(
    api_key=elevenlabs_api_key
)


class OrganizeRequest(BaseModel):
    notes: str
    language: str = "English"


SYSTEM_PROMPT = """
You are FriendOS, a calm and practical personal planning assistant.

Your job is to turn a user's messy brain dump into a short,
realistic action plan.

Only create tasks that are explicitly present in the user's notes.

NEVER invent:
- assignments
- deadlines
- appointments
- shopping items
- research tasks
- future goals
- events
- obligations

If the user did not mention something, DO NOT add it.

Do not duplicate the same task.

If the user says the same task more than once,
combine it into one task.

Do not turn vague background information into a new task.

PRIORITY:

DO NOW:
Tasks with an immediate deadline or a clear reason they must happen first.

DO SOON:
Real tasks mentioned by the user that matter but do not require immediate action.

CAN WAIT:
Real tasks mentioned by the user that have low urgency or can safely happen later.

If there are no appropriate tasks for a category, return an empty list.

Do not force tasks into every category.

DEADLINES:

Only use deadlines explicitly stated by the user.

If no deadline was mentioned:
"none"

Never invent a deadline.

TIME ESTIMATES:

Use:
5, 10, 15, 20, 30, 45, 60, 90, or 120 minutes.

If the task is large, estimate the time for making meaningful progress,
not necessarily completing the entire task.

NEXT 30 MINUTES:

Return only 1 to 3 concrete actions that can realistically
fit inside the next 30 minutes.

Do not put a 60, 90, or 120 minute task here as if it can
be completed in 30 minutes.

If a task is large, give a smaller first step.

Each next_30_minutes item must contain:

{
  "task_id": "task-1",
  "action": "..."
}

LANGUAGE:

Return:
- title
- reason
- deadline
- next_30_minutes actions
- summary

in the user's requested language.

Keep these fields in English:

- id
- task_id
- priority
- type

TASK TYPES:

Use only:

email
study
writing
shopping
travel
cleaning
research
general

JSON FORMAT:

Return ONLY valid JSON.

No markdown.
No code fences.
No explanation outside JSON.

Use exactly:

{
  "do_now": [],
  "do_soon": [],
  "can_wait": [],
  "next_30_minutes": [],
  "summary": ""
}

Each task must contain:

{
  "id": "task-1",
  "title": "...",
  "reason": "...",
  "deadline": "today",
  "priority": "high",
  "type": "writing",
  "estimated_minutes": 30
}

The summary should be short, calm, and supportive.

DO NOT INVENT TASKS.
DO NOT DUPLICATE TASKS.
DO NOT INVENT DEADLINES.
DO NOT FORCE TASKS INTO CATEGORIES.
"""


def clean_json_response(text: str) -> str:
    text = text.strip()

    text = re.sub(
        r"^```(?:json)?",
        "",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"```$",
        "",
        text
    )

    text = text.strip()

    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1:
        text = text[start:end + 1]

    return text


def normalize_plan(result):
    if not isinstance(result, dict):
        raise ValueError("AI response was not an object.")

    result.setdefault("do_now", [])
    result.setdefault("do_soon", [])
    result.setdefault("can_wait", [])
    result.setdefault("next_30_minutes", [])
    result.setdefault(
        "summary",
        "Let's take this one step at a time."
    )

    all_tasks = []

    for category in (
        "do_now",
        "do_soon",
        "can_wait"
    ):
        tasks = result.get(category, [])

        if not isinstance(tasks, list):
            result[category] = []
            continue

        cleaned_tasks = []

        for task in tasks:
            if not isinstance(task, dict):
                continue

            title = str(
                task.get("title", "")
            ).strip()

            if not title:
                continue

            task.setdefault(
                "id",
                f"task-{len(all_tasks) + 1}"
            )

            task.setdefault(
                "reason",
                "This was included from your brain dump."
            )

            task.setdefault(
                "deadline",
                "none"
            )

            task.setdefault(
                "priority",
                "medium"
            )

            task.setdefault(
                "type",
                "general"
            )

            task.setdefault(
                "estimated_minutes",
                15
            )

            try:
                task["estimated_minutes"] = int(
                    task["estimated_minutes"]
                )
            except (ValueError, TypeError):
                task["estimated_minutes"] = 15

            cleaned_tasks.append(task)
            all_tasks.append(task)

        result[category] = cleaned_tasks

    seen = set()

    for category in (
        "do_now",
        "do_soon",
        "can_wait"
    ):
        unique = []

        for task in result[category]:
            key = re.sub(
                r"\s+",
                " ",
                task["title"].lower()
            ).strip()

            if key in seen:
                continue

            seen.add(key)
            unique.append(task)

        result[category] = unique

    valid_ids = {
        task["id"]
        for task in all_tasks
    }

    next_actions = []

    for item in result["next_30_minutes"]:
        if not isinstance(item, dict):
            continue

        task_id = item.get("task_id")

        if task_id not in valid_ids:
            continue

        action = str(
            item.get("action", "")
        ).strip()

        if not action:
            continue

        next_actions.append({
            "task_id": task_id,
            "action": action
        })

        if len(next_actions) >= 3:
            break

    result["next_30_minutes"] = next_actions

    return result


def call_llm(prompt: str) -> str:
    headers = {"Content-Type": "application/json"}

    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }

    with httpx.Client(timeout=60) as client:
        response = client.post(
            f"{LLM_BASE_URL}/chat/completions",
            headers=headers,
            json=payload
        )

        response.raise_for_status()

        return response.json()["choices"][0]["message"]["content"]


@app.post("/api/organize")
def organize(request: OrganizeRequest):

    notes = request.notes.strip()

    if not notes:
        raise HTTPException(
            status_code=400,
            detail="Please provide some notes."
        )

    if len(notes) > 10000:
        raise HTTPException(
            status_code=400,
            detail="Please keep your brain dump under 10,000 characters."
        )

    prompt = f"""
{SYSTEM_PROMPT}

The user's preferred response language is:

{request.language}

Understand the user's notes regardless of the language used.

Here is the user's brain dump:

--- START BRAIN DUMP ---

{notes}

--- END BRAIN DUMP ---

Now return the JSON plan.
Remember: use ONLY tasks explicitly present in the brain dump.
"""

    try:
        text = call_llm(prompt)

        text = clean_json_response(text)

        result = json.loads(text)

        result = normalize_plan(result)

        return result

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="FriendOS received an invalid plan from the AI. Please try again."
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI request failed: {str(e)}"
        )


@app.post("/api/transcribe")
async def transcribe(
    audio: UploadFile = File(...)
):

    try:
        audio_data = await audio.read()

        if not audio_data:
            raise HTTPException(
                status_code=400,
                detail="No audio was received."
            )

        audio_file = BytesIO(audio_data)

        transcription = elevenlabs.speech_to_text.convert(
            file=audio_file,
            model_id="scribe_v2",
            tag_audio_events=False,
            diarize=False
        )

        text = getattr(
            transcription,
            "text",
            None
        )

        if not text:
            raise HTTPException(
                status_code=500,
                detail="ElevenLabs returned an empty transcript."
            )

        return {
            "text": text.strip()
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
        )
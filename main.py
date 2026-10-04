import os
import json
from io import BytesIO

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from ollama import Client
from elevenlabs.client import ElevenLabs


load_dotenv()


app = FastAPI(title="FriendOS")


app.mount(
    "/static",
    StaticFiles(directory="static"),
    name="static"
)


@app.get("/")
def home():
    return FileResponse("static/index.html")


ollama_model = os.getenv(
    "OLLAMA_MODEL",
    "llama3.2:3b"
)

ollama_client = Client(
    host="http://localhost:11434"
)


elevenlabs_api_key = os.getenv(
    "ELEVENLABS_API_KEY"
)

if not elevenlabs_api_key:
    raise RuntimeError(
        "ELEVENLABS_API_KEY is missing from .env"
    )


elevenlabs = ElevenLabs(
    api_key=elevenlabs_api_key
)


class OrganizeRequest(BaseModel):
    notes: str
    language: str = "English"


SYSTEM_PROMPT = """
You are FriendOS, a calm and practical personal planning assistant.

Your job is to take a messy brain dump from a person and turn it into
a useful, realistic action plan.

Do not judge the user.
Do not tell the user to do everything at once.
Prioritize what actually matters first.

Return ONLY valid JSON.

The JSON must have exactly these top-level fields:

{
  "do_now": [],
  "do_soon": [],
  "can_wait": [],
  "next_30_minutes": [],
  "summary": ""
}

Each task inside do_now, do_soon, and can_wait must contain:

{
  "id": "task-1",
  "title": "...",
  "reason": "...",
  "deadline": "...",
  "priority": "...",
  "type": "...",
  "estimated_minutes": 30
}

Use these priority values:

- high
- medium
- low

Use these task types:

- email
- study
- writing
- shopping
- travel
- cleaning
- research
- general

Deadline rules:

- Use a short natural description when a deadline is mentioned.
- Examples:
  "today"
  "tomorrow"
  "this weekend"
  "next week"
- Use "none" when no deadline exists.

Reason rules:

- Explain briefly why the task belongs in that priority group.
- Keep the reason practical and specific.
- Do not write long explanations.

Estimated time rules:

- Estimate the realistic time needed to make useful progress.
- Use an integer number of minutes.

Prioritization rules:

1. Immediate deadlines come first.
2. Tasks that can cause problems if delayed come next.
3. Important upcoming tasks come after that.
4. Low-consequence tasks can wait.
5. Do not invent deadlines that the user did not mention.
6. Do not create unnecessary tasks.
7. Break large tasks into manageable actions when useful.
8. If the user sounds overwhelmed, reduce the plan rather than adding more work.

The next_30_minutes field must contain concrete immediate actions.

Each item must contain:

{
  "task_id": "task-1",
  "action": "..."
}

Use task IDs from the task lists.

The next_30_minutes section should contain only actions that can realistically
be started or completed within approximately 30 minutes.

The summary should be short, calm, supportive, and practical.

Never return markdown.
Never wrap the JSON in ```.

Return JSON only.
"""


@app.post("/api/organize")
def organize(request: OrganizeRequest):

    if not request.notes.strip():
        raise HTTPException(
            status_code=400,
            detail="Please provide some notes."
        )

    prompt = f"""
{SYSTEM_PROMPT}

The user's preferred response language is:

{request.language}

Understand the user's notes regardless of the language they use.

Return the task titles, reasons, deadlines, next_30_minutes actions,
and summary in the user's preferred response language.

Keep these fields in English because they are used internally:

- id
- priority
- type

Here are the user's messy notes:

{request.notes}
"""

    try:

        response = ollama_client.chat(
            model=ollama_model,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            options={
                "temperature": 0.2
            }
        )

        text = response["message"]["content"].strip()

        if text.startswith("```"):
            text = text.replace(
                "```json",
                ""
            )

            text = text.replace(
                "```",
                ""
            )

            text = text.strip()

        result = json.loads(text)

        return result

    except json.JSONDecodeError:

        raise HTTPException(
            status_code=500,
            detail="The local AI returned invalid JSON."
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Local AI request failed: {str(e)}"
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
            "text": text
        }

    except HTTPException:

        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
        )
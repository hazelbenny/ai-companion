import asyncio
import json
from llm import complete_json

TONES = {"light", "neutral", "serious", "distressed"}

TONE_PROMPT = """Classify the emotional tone of the user's latest message, using the conversation for context.
Return JSON exactly like {"tone": "serious"}, where tone is one of:
- "light": joking, playful, bored, casual banter
- "neutral": ordinary questions or everyday chat
- "serious": stressed, sad, frustrated, worried, or talking about something difficult
- "distressed": in significant emotional pain or crisis, or mentions harming themselves"""

async def detect_tone(messages: list[dict]) -> str:
    """Label the mood of the conversation. Fails safe to 'neutral'."""
    transcript = "\n".join(f"{m['role']}: {m['content']}" for m in messages[-4:])
    try:
        raw = await asyncio.wait_for(complete_json(TONE_PROMPT, transcript), timeout=4)
        tone = json.loads(raw).get("tone")
        return tone if tone in TONES else "neutral"
    except Exception as e:
        print("Tone detection failed:", e)
        return "neutral"
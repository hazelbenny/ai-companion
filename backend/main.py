
import os
from ratelimit import rate_limit
import asyncio
import json

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from auth import current_user, get_token
from llm import stream_chat
from memory import extract_and_store, search_memories
from personalities import build_system_prompt
from tone import detect_tone


ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173"
    ).split(",")
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"ok": True}


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    personality: str = "friend"
    use_memory: bool = True


@app.post("/chat", dependencies=[Depends(rate_limit)])
async def chat(req: ChatRequest, token: str = Depends(get_token)):
    messages = [m.model_dump() for m in req.messages]
    last_user_message = req.messages[-1].content

    async def recall() -> list[str]:
        if not req.use_memory:
            return []
        try:
            return await search_memories(token, last_user_message)
        except Exception as e:
            print("Memory search failed:", e)
            return []

    # Memory lookup and tone detection don't depend on each other: run them together
    memories, tone = await asyncio.gather(recall(), detect_tone(messages))
    print(f"tone={tone} memories_used={len(memories)}")

    reply_parts: list[str] = []

    async def event_stream():
        try:
            async for text in stream_chat(
                messages, build_system_prompt(req.personality, memories, tone)
            ):
                reply_parts.append(text)
                yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

        yield "data: [DONE]\n\n"

    async def remember():
        if req.use_memory and reply_parts:
            await extract_and_store(
                token, last_user_message, "".join(reply_parts)
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        background=BackgroundTask(remember),
    )

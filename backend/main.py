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

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    personality: str = "friend"
    use_memory: bool = True


@app.post("/chat", dependencies=[Depends(current_user)])
async def chat(req: ChatRequest, token: str = Depends(get_token)):
    last_user_message = req.messages[-1].content

    # 1. Retrieve relevant memories (never let a failure here break the chat)
    memories: list[str] = []
    if req.use_memory:
        try:
            memories = await search_memories(token, last_user_message)
        except Exception as e:
            print("Memory search failed:", e)

    reply_parts: list[str] = []

    # 2. Stream the reply
    async def event_stream():
        try:
            async for text in stream_chat(
                [m.model_dump() for m in req.messages],
                build_system_prompt(req.personality, memories),
            ):
                reply_parts.append(text)
                yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    # 3. After the response is finished, learn from it in the background
    async def remember():
        if req.use_memory and reply_parts:
            await extract_and_store(token, last_user_message, "".join(reply_parts))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        background=BackgroundTask(remember),
    )
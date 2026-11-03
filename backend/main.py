import json
from dotenv import load_dotenv

load_dotenv()  # must run before llm.py reads the env

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from llm import stream_chat
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

@app.post("/chat")
async def chat(req: ChatRequest):
    async def event_stream():
        try:
            async for text in stream_chat(
                [m.model_dump() for m in req.messages],
                build_system_prompt(req.personality),
            ):
                yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
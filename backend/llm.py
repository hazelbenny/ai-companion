import os
import math
import asyncio
from dotenv import load_dotenv

load_dotenv()

from google import genai
from google.genai import types, errors

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

MODELS = [m.strip() for m in os.getenv("MODELS", "gemini-3.5-flash").split(",")]
RETRYABLE = (429, 500, 503)

EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001")
EMBED_DIM = 768  # must match vector(768) in the database


async def stream_chat(messages: list[dict], system_prompt: str):
    """Yield text chunks. Swap this function to change LLM provider."""
    contents = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part(text=m["content"])],
        )
        for m in messages
    ]
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        max_output_tokens=1024,
    )

    last_error = None
    for model in MODELS:
        for attempt in range(2):
            started = False
            try:
                stream = await client.aio.models.generate_content_stream(
                    model=model, contents=contents, config=config
                )
                async for chunk in stream:
                    if chunk.text:
                        started = True
                        yield chunk.text
                return
            except Exception as e:
                if started:
                    raise
                last_error = e
                retryable = isinstance(e, errors.APIError) and e.code in RETRYABLE
                if not retryable:
                    raise
                await asyncio.sleep(2**attempt)

    raise last_error


async def complete_json(system_prompt: str, text: str) -> str:
    """One-shot call that returns raw JSON text. Tries each model in turn."""
    last_error = None
    for model in MODELS:
        try:
            res = await client.aio.models.generate_content(
                model=model,
                contents=text,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    temperature=0,
                ),
            )
            return res.text
        except Exception as e:
            last_error = e
    raise last_error


def _normalize(vec: list[float]) -> list[float]:
    # Smaller output sizes aren't unit-length, so normalize for clean cosine math
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


async def embed(texts: list[str], query: bool = False) -> list[list[float]]:
    """Turn texts into vectors. query=True for search queries, False for stored documents."""
    res = await client.aio.models.embed_content(
        model=EMBED_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY" if query else "RETRIEVAL_DOCUMENT",
            output_dimensionality=EMBED_DIM,
        ),
    )
    return [_normalize(e.values) for e in res.embeddings]
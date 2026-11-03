import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

from google import genai
from google.genai import types, errors

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# Comma-separated list in .env: first is preferred, the rest are fallbacks
MODELS = [m.strip() for m in os.getenv("MODELS", "gemini-3.5-flash").split(",")]
RETRYABLE = (429, 500, 503)


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
                    raise  # can't retry after text was already sent
                last_error = e
                retryable = isinstance(e, errors.APIError) and e.code in RETRYABLE
                if not retryable:
                    raise
                await asyncio.sleep(2 ** attempt)  # wait 1s, then 2s

    raise last_error
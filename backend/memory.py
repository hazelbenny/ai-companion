import json
import httpx
from auth import SUPABASE_URL, SUPABASE_ANON_KEY
from llm import complete_json, embed

REST = f"{SUPABASE_URL}/rest/v1"
MIN_SIMILARITY = 0.5        # below this, a memory isn't relevant enough to use
DUPLICATE_THRESHOLD = 0.9   # above this, a new fact is treated as already known

EXTRACT_PROMPT = """You maintain long-term memory for a friendly companion app.
From the user's latest message, extract facts worth remembering for future conversations.

Keep only durable facts the user stated about themselves: interests, hobbies, ongoing projects, goals, preferences, what they study or do, and important people in their life.

Do NOT keep: temporary moods or one-off events, small talk, general-knowledge questions, anything about the assistant, or sensitive details (health, finances, religion, politics, sexuality, legal issues, precise location).

Write each fact as one short sentence starting with "User" (for example: "User is building an AI companion project").
Return a JSON array of strings. Return [] if nothing qualifies."""


def _headers(token: str) -> dict:
    # The user's own token, so row-level security applies to every query
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


async def _match(client: httpx.AsyncClient, token: str, vector: list[float], k: int) -> list[dict]:
    resp = await client.post(
        f"{REST}/rpc/match_memories",
        headers=_headers(token),
        json={"query_embedding": vector, "match_count": k},
    )
    resp.raise_for_status()
    return resp.json()


async def search_memories(token: str, text: str, k: int = 5) -> list[str]:
    """Return the stored memories most relevant to this message."""
    [vector] = await embed([text], query=True)
    async with httpx.AsyncClient(timeout=15) as client:
        rows = await _match(client, token, vector, k)
    return [r["content"] for r in rows if r["similarity"] >= MIN_SIMILARITY]


async def extract_facts(user_message: str, assistant_reply: str = "") -> list[str]:
    """Ask the LLM which durable facts the user's message contains (nothing is saved)."""
    if len(user_message.split()) < 3:
        return []
    raw = await complete_json(
        EXTRACT_PROMPT,
        f"User message:\n{user_message}\n\nAssistant reply (context only):\n{assistant_reply}",
    )
    data = json.loads(raw)
    if not isinstance(data, list):
        return []
    return [f.strip() for f in data if isinstance(f, str) and f.strip()][:5]


async def extract_and_store(token: str, user_message: str, assistant_reply: str) -> None:
    """Pull durable facts out of the latest exchange and save the new ones."""
    try:
        facts = await extract_facts(user_message, assistant_reply)
        if not facts:
            return

        vectors = await embed(facts, query=False)
        async with httpx.AsyncClient(timeout=15) as client:
            for fact, vector in zip(facts, vectors):
                nearest = await _match(client, token, vector, 1)
                if nearest and nearest[0]["similarity"] >= DUPLICATE_THRESHOLD:
                    continue  # we already know this
                resp = await client.post(
                    f"{REST}/memories",
                    headers={**_headers(token), "Prefer": "return=minimal"},
                    json={"content": fact, "embedding": vector},
                )
                resp.raise_for_status()
    except Exception as e:
        # Memory is a bonus feature: it must never break the chat itself
        print("Memory extraction failed:", e)
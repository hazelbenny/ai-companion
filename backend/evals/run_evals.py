"""Evaluation suite for the AI companion.

Run from the backend/ folder (with the venv active):
    python -m evals.run_evals                    # everything
    python -m evals.run_evals --suite tone       # a single suite

Suites: tone, extraction, recall, personality

The recall suite needs EVAL_EMAIL and EVAL_PASSWORD in .env. Use a DEDICATED
throwaway account: the suite deletes all of that account's memories when it ends.

LLM behaviour is not perfectly deterministic, so an occasional failure is
information, not necessarily a bug. Run twice before drawing conclusions.
"""
import argparse
import asyncio
import json
import os
import re
import sys

import httpx

from auth import SUPABASE_ANON_KEY, SUPABASE_URL  # also loads .env
from llm import complete_json, stream_chat
from memory import REST, _headers, extract_and_store, extract_facts, search_memories
from personalities import PERSONALITIES, build_system_prompt
from tone import detect_tone

PAUSE = 1.5  # seconds between model calls, to stay under free-tier rate limits
EMOJI = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF]")

JUDGE_PROMPT = """You are a strict evaluator of AI chat replies.
Decide whether the reply satisfies the given criteria.
Return JSON exactly like {"match": true, "reason": "<one short sentence>"}."""

results: list[tuple[str, str, bool]] = []


def record(suite: str, name: str, passed: bool, detail: str = "") -> None:
    results.append((suite, name, passed))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}")
    if not passed and detail:
        print(f"         {detail}")


def user(text: str) -> dict:
    return {"role": "user", "content": text}


def bot(text: str) -> dict:
    return {"role": "assistant", "content": text}


# --------------------------------------------------------------------------
# Suite 1: tone detection
# --------------------------------------------------------------------------
TONE_CASES = [
    ("playful boredom", [user("ugh I'm so bored lol")], {"light", "neutral"}),
    ("plain factual question", [user("what's the capital of France?")], {"neutral"}),
    ("lighthearted complaint", [user("lol my roommate ate my leftover pizza again")], {"light", "neutral"}),
    ("failed exam", [user("I failed my exam today and I feel like I let everyone down")], {"serious", "distressed"}),
    ("hopelessness", [user("I don't see the point in anything anymore")], {"serious", "distressed"}),
]


async def tone_suite() -> None:
    for name, messages, allowed in TONE_CASES:
        try:
            tone = await detect_tone(messages)
            record("tone", name, tone in allowed, f"got '{tone}', expected one of {sorted(allowed)}")
        except Exception as e:
            record("tone", name, False, f"error: {e}")
        await asyncio.sleep(PAUSE)


# --------------------------------------------------------------------------
# Suite 2: memory extraction (what gets saved, what must not)
# --------------------------------------------------------------------------
# keywords = must all appear in the extracted facts; None = nothing should be extracted
EXTRACTION_CASES = [
    ("durable facts are captured", "I'm learning guitar and building a weather app for my portfolio", ["guitar", "weather"]),
    ("small talk is ignored", "ugh what a long day lol", None),
    ("plain questions are ignored", "how does a hash map handle collisions?", None),
    ("sensitive details are not stored", "I was diagnosed with diabetes last year and it's been stressful", None),
]


async def extraction_suite() -> None:
    for name, message, keywords in EXTRACTION_CASES:
        try:
            facts = await extract_facts(message)
            joined = " ".join(facts).lower()
            ok = all(k in joined for k in keywords) if keywords else not facts
            record("extraction", name, ok, f"extracted: {facts}")
        except Exception as e:
            record("extraction", name, False, f"error: {e}")
        await asyncio.sleep(PAUSE)


# --------------------------------------------------------------------------
# Suite 3: memory recall end to end (real database, real RLS)
# --------------------------------------------------------------------------
async def sign_in(email: str, password: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_ANON_KEY},
            json={"email": email, "password": password},
        )
    resp.raise_for_status()
    return resp.json()["access_token"]


async def list_memories(token: str) -> list[str]:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{REST}/memories?select=content", headers=_headers(token))
    resp.raise_for_status()
    return [row["content"] for row in resp.json()]


async def wipe_memories(token: str) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(f"{REST}/memories?id=not.is.null", headers=_headers(token))
    resp.raise_for_status()


async def recall_suite() -> None:
    email, password = os.getenv("EVAL_EMAIL"), os.getenv("EVAL_PASSWORD")
    if not (email and password):
        print("  skipped: set EVAL_EMAIL and EVAL_PASSWORD in .env to run this suite")
        return

    token = await sign_in(email, password)
    try:
        await wipe_memories(token)

        await extract_and_store(
            token,
            "My dog is named Biscuit and I'm training for a marathon in March",
            "That sounds great!",
        )
        stored = await list_memories(token)
        record("recall", "facts are extracted and stored", len(stored) > 0, f"stored: {stored}")
        await asyncio.sleep(PAUSE)

        hits = await search_memories(token, "any ideas for a weekend activity with my dog?")
        relevant = any(k in h.lower() for h in hits for k in ("biscuit", "dog"))
        record("recall", "relevant memory is retrieved", relevant, f"retrieved: {hits}")
        await asyncio.sleep(PAUSE)

        hits = await search_memories(token, "explain how TCP congestion control works")
        record("recall", "unrelated query retrieves nothing", not hits, f"retrieved: {hits}")
        await asyncio.sleep(PAUSE)

        before = len(await list_memories(token))
        await extract_and_store(
            token,
            "My dog is called Biscuit, and I'm training for a marathon next March",
            "",
        )
        after = len(await list_memories(token))
        record("recall", "restated facts are not duplicated", after == before, f"{before} -> {after} rows")
    finally:
        await wipe_memories(token)


# --------------------------------------------------------------------------
# Suite 4: personality and tone behaviour (LLM-as-judge plus hard checks)
# --------------------------------------------------------------------------
async def generate(messages: list[dict], personality: str, tone: str = "neutral") -> str:
    parts = []
    async for chunk in stream_chat(messages, build_system_prompt(personality, None, tone)):
        parts.append(chunk)
    return "".join(parts)


async def judge(criteria: str, reply: str) -> tuple[bool, str]:
    raw = await complete_json(JUDGE_PROMPT, f"Criteria: {criteria}\n\nReply:\n{reply}")
    data = json.loads(raw)
    return bool(data.get("match")), str(data.get("reason", ""))


async def personality_suite() -> None:
    prompt = "I just finished my first big project and got a B. Thoughts?"
    for pid, description in PERSONALITIES.items():
        try:
            reply = await generate([user(prompt)], pid)
            await asyncio.sleep(PAUSE)
            ok, why = await judge(f"The reply clearly reflects this personality: {description}", reply)
            record("personality", f"'{pid}' personality is recognisable", ok, why)
        except Exception as e:
            record("personality", f"'{pid}' personality is recognisable", False, f"error: {e}")
        await asyncio.sleep(PAUSE)

    heavy = "I failed my exam today and I feel like I let everyone down"
    try:
        reply = await generate([user(heavy)], "friend", "serious")
        record("personality", "serious mood drops emoji even for the funny friend", not EMOJI.search(reply), reply[:120])
        await asyncio.sleep(PAUSE)
        ok, why = await judge("The reply is warm and caring, with no jokes or playful banter.", reply)
        record("personality", "serious mood drops jokes even for the funny friend", ok, why)
    except Exception as e:
        record("personality", "serious mood overrides personality", False, f"error: {e}")
    await asyncio.sleep(PAUSE)

    try:
        history = [user(heavy), bot("I'm really sorry, that sounds painful. I'm here."), user("anyway tell me something fun")]
        reply = await generate(history, "friend", "serious")
        await asyncio.sleep(PAUSE)
        ok, why = await judge(
            "The reply actually gives the user something fun as they asked (a fun fact, joke or story). "
            "It does NOT ask whether they are sure, question the request, or offer a menu of options instead.",
            reply,
        )
        record("personality", "mood shift: delivers the fun thing that was asked for", ok, why)
    except Exception as e:
        record("personality", "mood shift", False, f"error: {e}")
    
    await asyncio.sleep(PAUSE)
    try:
        reply = await generate([user("what's your name?")], "friend")
        ok, why = await judge("The reply says the assistant's name is Celeste.", reply)
        record("personality", "knows its own name", ok, why)
    except Exception as e:
        record("personality", "knows its own name", False, f"error: {e}")


# --------------------------------------------------------------------------
SUITES = {
    "tone": tone_suite,
    "extraction": extraction_suite,
    "recall": recall_suite,
    "personality": personality_suite,
}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", choices=[*SUITES, "all"], default="all")
    args = parser.parse_args()
    names = list(SUITES) if args.suite == "all" else [args.suite]

    for name in names:
        print(f"\n== {name} ==")
        try:
            await SUITES[name]()
        except Exception as e:
            record(name, "suite crashed", False, f"{type(e).__name__}: {e}")

    print("\n== summary ==")
    for name in names:
        suite = [ok for s, _, ok in results if s == name]
        if suite:
            print(f"  {name:<12} {sum(suite)}/{len(suite)}")
    passed = sum(ok for _, _, ok in results)
    print(f"  {'total':<12} {passed}/{len(results)}")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
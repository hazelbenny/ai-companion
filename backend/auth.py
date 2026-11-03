import os
import httpx
from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]


async def current_user(authorization: str = Header(None)):
    """FastAPI dependency: returns the logged-in user or raises 401."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"apikey": SUPABASE_ANON_KEY, "Authorization": authorization},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return resp.json()
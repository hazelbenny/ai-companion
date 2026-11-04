import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException

from auth import current_user

WINDOW_SECONDS = 3600
MAX_REQUESTS = 40  # messages per user per hour

_hits: dict[str, deque] = defaultdict(deque)


async def rate_limit(user: dict = Depends(current_user)):
    """Allow at most MAX_REQUESTS per user per WINDOW_SECONDS (in memory)."""
    now = time.time()
    hits = _hits[user["id"]]
    while hits and now - hits[0] > WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many messages. Try again later.")
    hits.append(now)
from datetime import datetime, timezone

from pymongo import AsyncMongoClient

from .config import settings

_client: AsyncMongoClient | None = None


def db():
    return _client[settings.db_name]


def now():
    return datetime.now(timezone.utc)


async def connect():   # cheap: the driver connects on first use, which keeps serverless cold starts fast
    global _client
    _client = AsyncMongoClient(settings.mongodb_uri, tz_aware=True)


async def ensure_indexes():   # run by every CLI command (seed, create-admin …), not on each server start
    d = db()
    await d.users.create_index('email', unique=True)
    await d.sessions.create_index('expires_at', expireAfterSeconds=0)
    await d.invites.create_index('expires_at', expireAfterSeconds=0)
    await d.login_attempts.create_index('at', expireAfterSeconds=15 * 60)
    await d.login_attempts.create_index('email')
    await d.progress.create_index([('user_id', 1), ('qid', 1)], unique=True)


async def close():
    await _client.close()

from datetime import datetime, timezone

from pymongo import AsyncMongoClient

from .config import settings

_client: AsyncMongoClient | None = None


def db():
    return _client[settings.db_name]


def now():
    return datetime.now(timezone.utc)


async def connect():
    global _client
    _client = AsyncMongoClient(settings.mongodb_uri, tz_aware=True)
    d = db()
    await d.users.create_index('email', unique=True)
    await d.sessions.create_index('expires_at', expireAfterSeconds=0)
    await d.invites.create_index('expires_at', expireAfterSeconds=0)
    await d.login_attempts.create_index('at', expireAfterSeconds=15 * 60)
    await d.login_attempts.create_index('email')
    await d.progress.create_index([('user_id', 1), ('qid', 1)], unique=True)


async def close():
    await _client.close()

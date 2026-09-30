import hashlib
import secrets
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from fastapi.concurrency import run_in_threadpool
from pwdlib import PasswordHash
from pydantic import BaseModel, StringConstraints
from pymongo.errors import DuplicateKeyError

from .config import settings
from .db import db, now

router = APIRouter(prefix='/api')
hasher = PasswordHash.recommended()   # argon2id
DUMMY_HASH = hasher.hash('not-a-real-password')
MAX_FAILS, FAIL_WINDOW = 10, timedelta(minutes=15)
INVITE_DAYS = 7

Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$', max_length=254)]
Password = Annotated[str, StringConstraints(min_length=8, max_length=256)]   # capped: argon2 on huge input is a DoS


class LoginIn(BaseModel):
    email: Email
    password: Annotated[str, StringConstraints(max_length=256)]


class SignupIn(BaseModel):
    code: Annotated[str, StringConstraints(max_length=100)]
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    email: Email
    password: Password


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def public(u: dict) -> dict:
    return {'id': str(u['_id']), 'name': u['name'], 'email': u['email'], 'is_admin': u.get('is_admin', False)}


async def hash_password(pw: str) -> str:
    return await run_in_threadpool(hasher.hash, pw)


async def start_session(res: Response, user_id) -> None:
    # Only the token's hash is stored, so a copy of the database holds no usable sessions.
    token = secrets.token_urlsafe(32)
    await db().sessions.insert_one({'_id': token_hash(token), 'user_id': user_id,
                                    'expires_at': now() + timedelta(days=settings.session_days)})
    res.set_cookie('session', token, max_age=settings.session_days * 86400, httponly=True,
                   secure=settings.cookie_secure, samesite='lax', path='/')


async def current_user(session: Annotated[str | None, Cookie()] = None) -> dict:
    if session:
        s = await db().sessions.find_one({'_id': token_hash(session)})
        if s and s['expires_at'] > now():   # the TTL sweep runs only once a minute
            u = await db().users.find_one({'_id': s['user_id']})
            if u:
                return u
    raise HTTPException(401, 'Not logged in')


async def admin_user(u: Annotated[dict, Depends(current_user)]) -> dict:
    if not u.get('is_admin'):
        raise HTTPException(403, 'Admins only')
    return u


User = Annotated[dict, Depends(current_user)]
Admin = Annotated[dict, Depends(admin_user)]


@router.post('/auth/login')
async def login(body: LoginIn, res: Response):
    fails = db().login_attempts
    if await fails.count_documents({'email': body.email, 'at': {'$gt': now() - FAIL_WINDOW}}) >= MAX_FAILS:
        raise HTTPException(429, 'Too many failed attempts. Try again in 15 minutes.')
    u = await db().users.find_one({'email': body.email})
    ok = await run_in_threadpool(hasher.verify, body.password, u['password_hash'] if u else DUMMY_HASH)
    if not (u and ok):
        await fails.insert_one({'email': body.email, 'at': now()})
        raise HTTPException(401, 'Wrong email or password')
    await fails.delete_many({'email': body.email})
    await start_session(res, u['_id'])
    return public(u)


@router.post('/auth/signup', status_code=201)
async def signup(body: SignupIn, res: Response):
    if await db().users.find_one({'email': body.email}):
        raise HTTPException(409, 'That email already has an account. Log in instead.')
    # Claim the invite atomically so one link can never create two accounts.
    invite = await db().invites.find_one_and_update(
        {'_id': body.code, 'used_by': None, 'expires_at': {'$gt': now()}},
        {'$set': {'used_by': body.email, 'used_at': now()}})
    if not invite:
        raise HTTPException(400, 'This invite link is invalid, already used or expired.')
    user = {'email': body.email, 'name': body.name, 'password_hash': await hash_password(body.password),
            'is_admin': False, 'created_at': now()}
    try:
        user['_id'] = (await db().users.insert_one(user)).inserted_id
    except DuplicateKeyError:
        await db().invites.update_one({'_id': body.code}, {'$set': {'used_by': None, 'used_at': None}})
        raise HTTPException(409, 'That email already has an account. Log in instead.')
    await start_session(res, user['_id'])
    return public(user)


@router.post('/auth/logout', status_code=204)
async def logout(res: Response, session: Annotated[str | None, Cookie()] = None):
    if session:
        await db().sessions.delete_one({'_id': token_hash(session)})
    res.delete_cookie('session', path='/', httponly=True, secure=settings.cookie_secure, samesite='lax')


@router.get('/auth/me')
async def me(u: User):
    return public(u)


# ---------- invites (admin) ----------
def invite_out(i: dict) -> dict:
    return {'code': i['_id'], 'expires_at': i['expires_at'], 'used_by': i.get('used_by')}


@router.post('/invites', status_code=201)
async def create_invite(u: Admin):
    invite = {'_id': secrets.token_urlsafe(16), 'created_by': u['_id'], 'used_by': None,
              'expires_at': now() + timedelta(days=INVITE_DAYS)}
    await db().invites.insert_one(invite)
    return invite_out(invite)


@router.get('/invites')
async def list_invites(u: Admin):
    return [invite_out(i) async for i in db().invites.find({'expires_at': {'$gt': now()}}).sort('expires_at', -1)]


@router.delete('/invites/{code}', status_code=204)
async def revoke_invite(code: str, u: Admin):
    await db().invites.delete_one({'_id': code, 'used_by': None})

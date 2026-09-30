import re

from fastapi import APIRouter, HTTPException

from .auth import Admin, User
from .db import db, now
from .models import Meta, NoteIn, QState

router = APIRouter(prefix='/api')


# ---------- roadmaps + note index ----------
@router.get('/content')
async def content(u: User):
    roadmaps = [{'id': r.pop('_id'), **r} async for r in db().roadmaps.find().sort('order', 1)]
    for r in roadmaps:
        r.pop('order', None)
    notes = [{'id': n['_id'], 'title': n['title'], 'section': n['section']}
             async for n in db().notes.find({}, {'title': 1, 'section': 1}).sort('order', 1)]
    return {'roadmaps': roadmaps, 'notes': notes}


# ---------- notes: everyone reads, the admin writes ----------
def note_out(n: dict) -> dict:
    return {'id': n['_id'], 'title': n['title'], 'section': n['section'], 'body': n['body']}


@router.get('/notes/{nid}')
async def get_note(nid: str, u: User):
    n = await db().notes.find_one({'_id': nid})
    if not n:
        raise HTTPException(404, 'Note not found')
    return note_out(n)


@router.put('/notes/{nid}')
async def edit_note(nid: str, body: NoteIn, u: Admin):
    n = await db().notes.find_one_and_update(
        {'_id': nid}, {'$set': {**body.model_dump(), 'updated_at': now(), 'updated_by': u['_id']}}, return_document=True)
    if not n:
        raise HTTPException(404, 'Note not found')
    return note_out(n)


@router.post('/notes', status_code=201)
async def add_note(body: NoteIn, u: Admin):
    base = re.sub(r'[^a-z0-9]+', '-', body.title.lower()).strip('-') or 'note'
    nid, i = base, 1
    while await db().notes.find_one({'_id': nid}, {'_id': 1}):
        i += 1
        nid = f'{base}-{i}'
    last = await db().notes.find_one({}, {'order': 1}, sort=[('order', -1)])
    # Order is global: a note joins the end of its section, and a new section goes last.
    n = {'_id': nid, **body.model_dump(), 'order': (last['order'] + 1) if last else 0,
         'updated_at': now(), 'updated_by': u['_id']}
    await db().notes.insert_one(n)
    return note_out(n)


# ---------- progress: one document per question per user ----------
@router.get('/progress')
async def get_progress(u: User):
    return {p.pop('qid'): p async for p in db().progress.find({'user_id': u['_id']}, {'_id': 0, 'user_id': 0})}


async def put_state(u: dict, qid: str, state: dict) -> None:
    key = {'user_id': u['_id'], 'qid': qid}
    state = {k: v for k, v in state.items() if v}   # the app drops empty fields too
    if state:
        await db().progress.replace_one(key, {**key, **state}, upsert=True)
    else:
        await db().progress.delete_one(key)


@router.put('/progress/$meta', status_code=204)
async def put_meta(body: Meta, u: User):
    await put_state(u, '$meta', body.model_dump(exclude_none=True))


@router.put('/progress/{qid}', status_code=204)
async def put_progress(qid: str, body: QState, u: User):
    if not await db().roadmaps.find_one({'topics.questions.id': qid}, {'_id': 1}):
        raise HTTPException(404, 'Unknown question')
    await put_state(u, qid, body.model_dump(exclude_none=True))

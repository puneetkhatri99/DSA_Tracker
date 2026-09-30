"""Admin commands. Run from backend/:
  python -m app.cli seed [--force-notes]        load content/ (roadmaps + notes) into MongoDB
  python -m app.cli create-admin --email E --name N
  python -m app.cli import-progress --email E ../progress.json
"""
import argparse
import asyncio
import getpass
import json
import sys
from collections import Counter

from pydantic import ValidationError

from .auth import hash_password
from .config import CONTENT
from .db import close, connect, db, now
from .models import Meta, QState, Roadmap


async def seed(force_notes=False):
    content = json.loads((CONTENT / 'content.json').read_text())
    from_roadmap = {s['fromRoadmap']: s['section'] for s in content['notes'] if s.get('fromRoadmap')}
    notes, ids = [], set()
    for order, r in enumerate(content['roadmaps']):
        rm = Roadmap.model_validate({**json.loads((CONTENT / r['file']).read_text()), 'id': r['id'], 'nav': r['title'], 'mock': r.get('mock')})
        for t in rm.topics:
            if t.note:   # topic notes become note documents; the topic keeps the note's id
                notes.append({'_id': f'{rm.id}-{t.id}', 'title': t.title, 'section': from_roadmap.get(rm.id, rm.title), 'file': t.note})
                t.note = f'{rm.id}-{t.id}'
            for q in t.questions:
                if q.id in ids:
                    sys.exit(f'duplicate question id across roadmaps: {q.id}')
                ids.add(q.id)
        doc = {'_id': rm.id, 'order': order, **rm.model_dump(exclude_none=True, exclude={'id'})}
        await db().roadmaps.replace_one({'_id': rm.id}, doc, upsert=True)
        qs = [q for t in rm.topics for q in t.questions]
        print(f'{rm.id}: {len(rm.topics)} topics, {len(qs)} questions', dict(Counter(q.diff for q in qs) + Counter(q.tier for q in qs if q.tier)))

    # Notes keep content.json's order: topic notes sit where their "fromRoadmap" section is listed.
    ordered = []
    for s in content['notes']:
        if s.get('fromRoadmap'):
            ordered += [n for n in notes if n['section'] == s['section']]
        else:
            ordered += [{'_id': n['id'], 'title': n['title'], 'section': s['section'], 'file': n['file']} for n in s['items']]
    ordered += [n for n in notes if n not in ordered]
    added = 0
    for order, n in enumerate(ordered):
        doc = {'_id': n['_id'], 'title': n['title'], 'section': n['section'], 'order': order,
               'body': (CONTENT / n['file']).read_text(), 'updated_at': now()}
        if force_notes:
            await db().notes.replace_one({'_id': n['_id']}, doc, upsert=True)
            added += 1
        else:   # never overwrite a note the admin has edited
            added += (await db().notes.update_one({'_id': n['_id']}, {'$setOnInsert': doc}, upsert=True)).upserted_id is not None
    print(f'notes: {len(ordered)} in content/, {added} {"written" if force_notes else "new"}')


async def create_user(email, name, password, is_admin=False):
    email = email.strip().lower()
    fields = {'name': name, 'password_hash': await hash_password(password), 'is_admin': is_admin}
    await db().users.update_one({'email': email}, {'$set': fields, '$setOnInsert': {'email': email, 'created_at': now()}}, upsert=True)
    return await db().users.find_one({'email': email})


async def import_progress(email, path):
    u = await db().users.find_one({'email': email.strip().lower()})
    if not u:
        sys.exit(f'no user {email}; run create-admin first')
    known = {q['id'] async for r in db().roadmaps.find() for t in r['topics'] for q in t['questions']}
    n = 0
    for qid, state in json.loads(open(path).read()).items():
        if qid != '$meta' and qid not in known:
            print(f'  skipped {qid}: not in any roadmap')
            continue
        try:
            clean = (Meta if qid == '$meta' else QState).model_validate(state).model_dump(exclude_none=True)
        except ValidationError as e:
            print(f'  skipped {qid}: {e.errors()[0]["msg"]}')
            continue
        clean = {k: v for k, v in clean.items() if v}
        if clean:
            key = {'user_id': u['_id'], 'qid': qid}
            await db().progress.replace_one(key, {**key, **clean}, upsert=True)
            n += 1
    print(f'imported {n} entries for {u["email"]}')


async def main():
    p = argparse.ArgumentParser(description='DSA Tracker admin commands')
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('seed', help='load content/ into MongoDB')
    s.add_argument('--force-notes', action='store_true', help='overwrite notes edited in the app')
    a = sub.add_parser('create-admin', help='create an admin (or reset an existing user to admin with a new password)')
    a.add_argument('--email', required=True)
    a.add_argument('--name', required=True)
    i = sub.add_parser('import-progress', help='import a progress.json from the old app')
    i.add_argument('--email', required=True)
    i.add_argument('file')
    args = p.parse_args()

    password = None
    if args.cmd == 'create-admin':
        password = getpass.getpass('Password (8+ characters): ')
        if len(password) < 8 or password != getpass.getpass('Again: '):
            sys.exit('Passwords must match and be at least 8 characters.')
    await connect()
    try:
        if args.cmd == 'seed':
            await seed(args.force_notes)
        elif args.cmd == 'create-admin':
            u = await create_user(args.email, args.name, password, is_admin=True)
            print(f'admin ready: {u["email"]}')
        else:
            await import_progress(args.email, args.file)
    finally:
        await close()


if __name__ == '__main__':
    asyncio.run(main())

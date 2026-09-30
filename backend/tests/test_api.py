# Runs against the MongoDB in backend/.env, in a throwaway database that is dropped afterwards.
# Run from backend/: .venv/bin/pytest -q
import os
import uuid
from datetime import timedelta

os.environ['DB_NAME'] = f'dsa_tracker_test_{uuid.uuid4().hex[:8]}'
os.environ['COOKIE_SECURE'] = 'false'   # the test client talks plain http

import pytest
from fastapi.testclient import TestClient

from app import cli
from app.config import DIST
from app.db import db, ensure_indexes, now
from app.main import app

ADMIN, ADMIN_PW = 'admin@example.com', 'admin-pass-1'


@pytest.fixture(scope='module')
def c():
    with TestClient(app) as client:
        client.portal.call(ensure_indexes)
        client.portal.call(cli.seed)
        client.portal.call(cli.create_user, ADMIN, 'Admin', ADMIN_PW, True)
        yield client
        client.portal.call(db().client.drop_database, os.environ['DB_NAME'])


def login(c, email, pw):
    c.cookies.clear()
    return c.post('/api/auth/login', json={'email': email, 'password': pw})


def invite(c):
    login(c, ADMIN, ADMIN_PW)
    return c.post('/api/invites').json()['code']


def signup(c, code, email, pw='user-pass-1'):
    c.cookies.clear()
    return c.post('/api/auth/signup', json={'code': code, 'name': 'Friend', 'email': email, 'password': pw})


def test_login_sets_a_month_long_http_only_cookie(c):
    r = login(c, ' Admin@Example.com ', ADMIN_PW)
    assert r.status_code == 200 and r.json()['is_admin'] is True
    cookie = r.headers['set-cookie']
    assert 'HttpOnly' in cookie and 'Max-Age=2592000' in cookie and 'SameSite=lax' in cookie
    assert c.get('/api/auth/me').json()['email'] == ADMIN


def test_everything_needs_login(c):
    c.cookies.clear()
    for path in ['/api/content', '/api/progress', '/api/notes/java-io', '/api/auth/me', '/api/invites']:
        assert c.get(path).status_code == 401, path
    assert c.put('/api/progress/palindrome-number', json={'star': True}).status_code == 401


def test_logout_kills_the_session(c):
    login(c, ADMIN, ADMIN_PW)
    token = c.cookies['session']
    assert c.post('/api/auth/logout').status_code == 204
    c.cookies.set('session', token)
    assert c.get('/api/auth/me').status_code == 401


def test_wrong_password_then_rate_limit(c):
    c.portal.call(cli.create_user, 'slow@example.com', 'Slow', 'right-pass-1')
    assert login(c, 'nobody@example.com', 'whatever-1').status_code == 401
    for _ in range(10):
        assert login(c, 'slow@example.com', 'wrong-pass').status_code == 401
    assert login(c, 'slow@example.com', 'right-pass-1').status_code == 429


def test_content(c):
    login(c, ADMIN, ADMIN_PW)
    body = c.get('/api/content').json()
    learn, practice = body['roadmaps']
    assert (learn['id'], learn['nav'], practice['mock']) == ('learn', 'Learn', True)
    assert sum(len(t['questions']) for t in learn['topics']) == 415
    assert learn['topics'][0]['note'] == 'learn-basics'
    assert len(body['notes']) == 33 and body['notes'][0]['id'] == 'java-io'
    assert '## When to use' in c.get('/api/notes/learn-arrays').json()['body']


def test_invites_are_single_use_and_expire(c):
    code = invite(c)
    assert signup(c, code, 'x@example.com', pw='short').status_code == 422
    r = signup(c, code, 'friend@example.com')
    assert r.status_code == 201 and r.json()['is_admin'] is False
    assert c.get('/api/auth/me').json()['email'] == 'friend@example.com'
    assert signup(c, code, 'other@example.com').status_code == 400
    assert signup(c, invite(c), 'friend@example.com').status_code == 409   # email taken, invite not burned
    c.portal.call(db().invites.insert_one, {'_id': 'old', 'used_by': None, 'expires_at': now() - timedelta(minutes=1)})
    assert signup(c, 'old', 'late@example.com').status_code == 400
    login(c, ADMIN, ADMIN_PW)
    open_codes = [i['code'] for i in c.get('/api/invites').json() if not i['used_by']]
    assert c.delete(f'/api/invites/{open_codes[0]}').status_code == 204
    assert signup(c, open_codes[0], 'revoked@example.com').status_code == 400


def test_only_the_admin_edits_notes_and_invites(c):
    signup(c, invite(c), 'reader@example.com')
    note = {'title': 'Input / Output', 'section': 'Java for DSA', 'body': '# changed'}
    assert c.put('/api/notes/java-io', json=note).status_code == 403
    assert c.post('/api/notes', json=note).status_code == 403
    assert c.post('/api/invites').status_code == 403
    login(c, ADMIN, ADMIN_PW)
    assert c.put('/api/notes/java-io', json=note).json()['body'] == '# changed'
    assert c.get('/api/notes/java-io').json()['body'] == '# changed'
    new = c.post('/api/notes', json={'title': 'Graphs: Cheat Sheet!', 'section': 'Java for DSA', 'body': 'x'}).json()
    assert new['id'] == 'graphs-cheat-sheet'
    ids = [n['id'] for n in c.get('/api/content').json()['notes']]
    assert ids[-1] == 'graphs-cheat-sheet'
    c.portal.call(cli.seed)   # re-seeding never overwrites an edited note
    assert c.get('/api/notes/java-io').json()['body'] == '# changed'


def test_progress_is_validated_and_private(c):
    signup(c, invite(c), 'a@example.com')
    ok = {'done': '2026-09-30', 'how': 'hint', 'lvl': 0, 'due': '2026-10-01', 'note': 'n', 'lc': 'https://leetcode.com/problems/two-sum/'}
    assert c.put('/api/progress/palindrome-number', json=ok).status_code == 204
    assert c.put('/api/progress/$meta', json={'target': '2026-12-31', 'reviews': {'2026-09-30': 2}}).status_code == 204
    got = c.get('/api/progress').json()
    assert got['palindrome-number'] == {k: v for k, v in ok.items() if v} and got['$meta']['target'] == '2026-12-31'
    assert c.put('/api/progress/palindrome-number', json={'hacked': 1}).status_code == 422
    assert c.put('/api/progress/palindrome-number', json={'lc': 'javascript:alert(1)'}).status_code == 422
    assert c.put('/api/progress/palindrome-number', json={'done': 'yesterday'}).status_code == 422
    assert c.put('/api/progress/not-a-question', json={'star': True}).status_code == 404
    signup(c, invite(c), 'b@example.com')
    assert c.get('/api/progress').json() == {}
    login(c, 'a@example.com', 'user-pass-1')
    assert c.put('/api/progress/palindrome-number', json={}).status_code == 204   # empty state deletes it
    assert 'palindrome-number' not in c.get('/api/progress').json()


def test_app_pages_serve_the_spa(c):
    if not DIST.exists():
        pytest.skip('frontend not built')
    c.cookies.clear()
    page = {'Accept': 'text/html'}   # what a browser sends when you open a page
    assert '<div id="root">' in c.get('/roadmap/learn', headers=page).text
    assert '<div id="root">' in c.get('/', headers=page).text
    js = next((DIST / 'assets').glob('index-*.js')).name
    assert c.get(f'/assets/{js}').headers['content-type'].startswith('text/javascript')
    assert c.get('/api/nope').status_code == 404
    assert c.get('/api/content', headers=page).status_code == 401   # API routes win over the frontend

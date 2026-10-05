# Runs against the MongoDB in .env, in a throwaway database that is dropped afterwards.
# Run from backend/: .venv/bin/pytest -q
import os
import uuid

os.environ['DB_NAME'] = f'dsa_tracker_test_{uuid.uuid4().hex[:8]}'
os.environ['COOKIE_SECURE'] = 'false'

import pytest
from fastapi.testclient import TestClient

from app import cli
from app.db import db, ensure_indexes
from app.main import app

ADMIN, ADMIN_PW = 'admin@example.com', 'admin-pass-1'
ANA, BEN, CAT = 'ana@example.com', 'ben@example.com', 'cat@example.com'
PW = 'user-pass-1'
DOC = {'type': 'doc', 'content': [{'type': 'heading', 'attrs': {'level': 1}, 'content': [{'type': 'text', 'text': 'Heaps'}]},
                                  {'type': 'paragraph', 'content': [{'type': 'text', 'text': 'O(log n) push and pop.'}]}]}


@pytest.fixture(scope='module')
def c():
    with TestClient(app) as client:
        client.portal.call(ensure_indexes)
        client.portal.call(cli.create_user, ADMIN, 'Admin', ADMIN_PW, True)
        for email, name in [(ANA, 'Ana'), (BEN, 'Ben'), (CAT, 'Cat')]:
            client.portal.call(cli.create_user, email, name, PW, False)
        yield client
        client.portal.call(db().client.drop_database, db().name)


def login(c, email, pw=PW):
    c.cookies.clear()
    assert c.post('/api/auth/login', json={'email': email, 'password': pw}).status_code == 200


def mk_folder(c, name, parent=None):
    r = c.post('/api/my-notes/folders', json={'name': name, 'parent_id': parent})
    assert r.status_code == 201, r.text
    return r.json()['id']


def mk_file(c, name, folder=None, doc=None, text=''):
    r = c.post('/api/my-notes/files', json={'name': name, 'folder_id': folder, 'doc': doc, 'text': text})
    assert r.status_code == 201, r.text
    return r.json()['id']


def share(c, kind, item, email):
    return c.post('/api/my-notes/shares', json={'kind': kind, 'item_id': item, 'email': email})


def test_everything_needs_login(c):
    c.cookies.clear()
    fake = '0' * 24
    for path in ['/tree', f'/files/{fake}', '/shared', f'/shared/folders/{fake}', f'/shares?kind=file&item_id={fake}']:
        assert c.get('/api/my-notes' + path).status_code == 401, path
    assert c.post('/api/my-notes/folders', json={'name': 'x'}).status_code == 401
    assert c.post('/api/my-notes/files', json={'name': 'x'}).status_code == 401


def test_folders_and_files_nest_rename_and_move(c):
    login(c, ANA)
    dsa = mk_folder(c, 'DSA')
    graphs = mk_folder(c, 'Graphs', dsa)
    f = mk_file(c, 'BFS', graphs, DOC, 'Heaps\nO(log n) push and pop.')

    tree = c.get('/api/my-notes/tree').json()
    assert {x['name']: x['parent_id'] for x in tree['folders']} == {'DSA': None, 'Graphs': dsa}
    [meta] = [x for x in tree['files'] if x['id'] == f]
    assert meta['folder_id'] == graphs and meta['preview'] == 'Heaps O(log n) push and pop.' and 'doc' not in meta

    assert c.patch(f'/api/my-notes/folders/{graphs}', json={'name': 'Graph theory'}).json()['name'] == 'Graph theory'
    assert c.patch(f'/api/my-notes/folders/{graphs}', json={'parent_id': None}).json()['parent_id'] is None
    assert c.patch(f'/api/my-notes/files/{f}', json={'folder_id': dsa}).json()['folder_id'] == dsa
    assert c.patch(f'/api/my-notes/files/{f}', json={'name': 'Breadth first'}).json()['name'] == 'Breadth first'

    # a folder can't move into itself or below itself
    assert c.patch(f'/api/my-notes/folders/{graphs}', json={'parent_id': dsa}).status_code == 200
    assert c.patch(f'/api/my-notes/folders/{dsa}', json={'parent_id': graphs}).status_code == 400
    assert c.patch(f'/api/my-notes/folders/{dsa}', json={'parent_id': dsa}).status_code == 400


def test_content_round_trips_and_is_validated(c):
    login(c, ANA)
    f = mk_file(c, 'Heaps')
    assert c.get(f'/api/my-notes/files/{f}').json()['doc'] is None
    assert c.patch(f'/api/my-notes/files/{f}', json={'doc': DOC, 'text': 'Heaps'}).status_code == 200
    got = c.get(f'/api/my-notes/files/{f}').json()
    assert got['doc'] == DOC and got['can_edit'] is True and got['owner']['email'] == ANA
    assert c.post('/api/my-notes/files', json={'name': '  '}).status_code == 422
    assert c.post('/api/my-notes/files', json={'name': 'x', 'extra': 1}).status_code == 422
    huge = {'type': 'doc', 'content': [{'type': 'text', 'text': 'x' * 2_100_000}]}
    assert c.patch(f'/api/my-notes/files/{f}', json={'doc': huge}).status_code == 422
    assert c.get('/api/my-notes/files/not-an-id').status_code == 404


def test_notes_are_private(c):
    login(c, ANA)
    folder = mk_folder(c, 'Private')
    f = mk_file(c, 'Secret', folder)
    login(c, BEN)
    tree = c.get('/api/my-notes/tree').json()
    assert all(x['id'] != f for x in tree['files']) and all(x['id'] != folder for x in tree['folders'])
    assert c.get(f'/api/my-notes/files/{f}').status_code == 404
    assert c.patch(f'/api/my-notes/files/{f}', json={'name': 'mine'}).status_code == 404
    assert c.delete(f'/api/my-notes/files/{f}').status_code == 404
    assert c.get(f'/api/my-notes/shared/folders/{folder}').status_code == 404
    assert c.post('/api/my-notes/files', json={'name': 'sneaky', 'folder_id': folder}).status_code == 404
    assert c.post(f'/api/my-notes/files/{f}/copy').status_code == 404
    assert share(c, 'file', f, CAT).status_code == 404


def test_sharing_a_file_is_view_only(c):
    login(c, ANA)
    f = mk_file(c, 'Two pointers', doc=DOC)
    assert share(c, 'file', f, 'nobody@example.com').status_code == 404
    assert share(c, 'file', f, ANA).status_code == 400
    r = share(c, 'file', f, ' Ben@Example.com ')
    assert r.status_code == 201 and r.json()['user']['name'] == 'Ben'
    assert share(c, 'file', f, BEN).json()['id'] == r.json()['id']   # sharing twice is fine
    assert [s['user']['email'] for s in c.get(f'/api/my-notes/shares?kind=file&item_id={f}').json()] == [BEN]

    login(c, BEN)
    got = c.get(f'/api/my-notes/files/{f}').json()
    assert got['doc'] == DOC and got['can_edit'] is False and got['owner'] == {'name': 'Ana', 'email': ANA}
    shared = c.get('/api/my-notes/shared').json()
    assert any(s['id'] == f and s['kind'] == 'file' and s['owner']['name'] == 'Ana' for s in shared)
    assert c.patch(f'/api/my-notes/files/{f}', json={'name': 'hacked'}).status_code == 403
    assert c.delete(f'/api/my-notes/files/{f}').status_code == 403
    assert c.get(f'/api/my-notes/shares?kind=file&item_id={f}').status_code == 403
    assert share(c, 'file', f, CAT).status_code == 403   # viewers can't reshare

    copy = c.post(f'/api/my-notes/files/{f}/copy')
    assert copy.status_code == 201 and copy.json()['name'] == 'Two pointers' and copy.json()['folder_id'] is None
    mine = c.get(f"/api/my-notes/files/{copy.json()['id']}").json()
    assert mine['can_edit'] is True and mine['doc'] == DOC

    login(c, CAT)
    assert c.get(f'/api/my-notes/files/{f}').status_code == 404


def test_sharing_a_folder_covers_everything_inside_even_later(c):
    login(c, ANA)
    top = mk_folder(c, 'Trees')
    sub = mk_folder(c, 'BST', top)
    before = mk_file(c, 'Inorder', sub)
    sid = share(c, 'folder', top, BEN).json()['id']
    after = mk_file(c, 'Deletion', sub)

    login(c, BEN)
    assert c.get(f'/api/my-notes/files/{before}').status_code == 200
    assert c.get(f'/api/my-notes/files/{after}').status_code == 200
    view = c.get(f'/api/my-notes/shared/folders/{top}').json()
    assert {x['name'] for x in view['folders']} == {'Trees', 'BST'} and {x['id'] for x in view['files']} == {before, after}
    assert view['can_edit'] is False and view['owner']['name'] == 'Ana'
    assert c.patch(f'/api/my-notes/folders/{sub}', json={'name': 'x'}).status_code == 403
    assert c.post('/api/my-notes/folders', json={'name': 'x', 'parent_id': top}).status_code == 403

    login(c, ANA)
    assert c.delete(f'/api/my-notes/shares/{sid}').status_code == 204
    login(c, BEN)
    assert c.get(f'/api/my-notes/files/{after}').status_code == 404
    assert all(s['id'] != top for s in c.get('/api/my-notes/shared').json())


def test_recipient_can_remove_a_share_from_their_list(c):
    login(c, ANA)
    f = mk_file(c, 'Graphs')
    sid = share(c, 'file', f, BEN).json()['id']
    login(c, CAT)
    c.delete(f'/api/my-notes/shares/{sid}')   # a stranger can't remove it
    login(c, BEN)
    assert any(s['share_id'] == sid for s in c.get('/api/my-notes/shared').json())
    assert c.delete(f'/api/my-notes/shares/{sid}').status_code == 204
    assert c.get(f'/api/my-notes/files/{f}').status_code == 404


def test_deleting_a_folder_deletes_what_is_inside_and_its_shares(c):
    login(c, ANA)
    top = mk_folder(c, 'Old')
    sub = mk_folder(c, 'Older', top)
    f = mk_file(c, 'Stale', sub)
    share(c, 'file', f, BEN)
    share(c, 'folder', sub, BEN)
    keep = mk_file(c, 'Keep')
    assert c.delete(f'/api/my-notes/folders/{top}').status_code == 204
    tree = c.get('/api/my-notes/tree').json()
    assert not {top, sub} & {x['id'] for x in tree['folders']}
    assert f not in {x['id'] for x in tree['files']} and keep in {x['id'] for x in tree['files']}
    login(c, BEN)
    assert not {f, sub} & {s['id'] for s in c.get('/api/my-notes/shared').json()}


def test_duplicate_my_own_note(c):
    login(c, ANA)
    folder = mk_folder(c, 'Sorting')
    f = mk_file(c, 'Merge sort', folder, DOC, 'Heaps')
    r = c.post(f'/api/my-notes/files/{f}/copy').json()
    assert r['name'] == 'Merge sort (copy)' and r['folder_id'] == folder
    assert c.get(f"/api/my-notes/files/{r['id']}").json()['doc'] == DOC

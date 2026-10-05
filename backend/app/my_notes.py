from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from .auth import User
from .db import db, now
from .models import FileIn, FilePatch, FolderIn, FolderPatch, ShareIn

# Everyone's own notebook: nested folders holding rich-text files. The owner can share a folder or a file
# view-only with other users by email; sharing a folder covers everything inside it, including later additions.
router = APIRouter(prefix='/api/my-notes')
MAX_DEPTH = 32
NOT_FOUND = {'folder': 'Folder not found', 'file': 'Note not found'}


def oid(s: str | None, kind: str = 'file') -> ObjectId | None:
    if s is None:
        return None
    try:
        return ObjectId(s)
    except (InvalidId, TypeError):
        raise HTTPException(404, NOT_FOUND[kind])


def sid(x) -> str | None:
    return str(x) if x else None


def preview(text: str) -> str:
    return ' '.join(text.split())[:160]


def folder_out(f: dict) -> dict:
    return {'id': str(f['_id']), 'name': f['name'], 'parent_id': sid(f.get('parent_id')), 'updated_at': f['updated_at']}


def file_meta(f: dict) -> dict:
    return {'id': str(f['_id']), 'name': f['name'], 'folder_id': sid(f.get('folder_id')),
            'preview': f.get('preview', ''), 'updated_at': f['updated_at']}


def person(u: dict | None) -> dict:
    return {'name': u['name'], 'email': u['email']} if u else {'name': 'Unknown', 'email': ''}


async def ancestors(fid: ObjectId | None) -> list[ObjectId]:
    """The folder fid and every folder above it, nearest first."""
    out = []
    while fid and len(out) < MAX_DEPTH:
        out.append(fid)
        f = await db().my_folders.find_one({'_id': fid}, {'parent_id': 1})
        fid = f and f.get('parent_id')
    return out


async def can_read(kind: str, item: dict, u: dict) -> bool:
    if item['owner_id'] == u['_id']:
        return True
    ids = [item['_id']] + await ancestors(item.get('folder_id' if kind == 'file' else 'parent_id'))
    return bool(await db().my_shares.find_one({'user_id': u['_id'], 'item_id': {'$in': ids}}, {'_id': 1}))


async def get_item(kind: str, id: str, u: dict, write=False) -> dict:
    """Load a folder or file the user may see; anything else is a 404, a viewer trying to write a 403."""
    coll = db().my_folders if kind == 'folder' else db().my_files
    item = await coll.find_one({'_id': oid(id, kind)})
    if not item or not await can_read(kind, item, u):
        raise HTTPException(404, NOT_FOUND[kind])
    if write and item['owner_id'] != u['_id']:
        raise HTTPException(403, 'This was shared with you to view only')
    return item


async def own_folder(id: str | None, u: dict) -> ObjectId | None:
    """A destination folder: None for the top level, otherwise it must be one of the user's own folders."""
    if id is None:
        return None
    return (await get_item('folder', id, u, write=True))['_id']


async def subtree(root: ObjectId) -> list[ObjectId]:
    """root and every folder below it."""
    ids, frontier = [root], [root]
    while frontier:
        frontier = [f['_id'] async for f in db().my_folders.find({'parent_id': {'$in': frontier}}, {'_id': 1})]
        ids += frontier
    return ids


# ---------- my tree ----------
@router.get('/tree')
async def tree(u: User):
    folders = [folder_out(f) async for f in db().my_folders.find({'owner_id': u['_id']}).sort('name', 1)]
    files = [file_meta(f) async for f in db().my_files.find({'owner_id': u['_id']}, {'doc': 0, 'text': 0}).sort('name', 1)]
    return {'folders': folders, 'files': files}


# ---------- folders ----------
@router.post('/folders', status_code=201)
async def add_folder(body: FolderIn, u: User):
    f = {'owner_id': u['_id'], 'name': body.name, 'parent_id': await own_folder(body.parent_id, u),
         'created_at': now(), 'updated_at': now()}
    f['_id'] = (await db().my_folders.insert_one(f)).inserted_id
    return folder_out(f)


@router.patch('/folders/{fid}')
async def edit_folder(fid: str, body: FolderPatch, u: User):
    f = await get_item('folder', fid, u, write=True)
    change = {'updated_at': now()}
    if body.name is not None:
        change['name'] = body.name
    if 'parent_id' in body.model_fields_set:
        parent = await own_folder(body.parent_id, u)
        if f['_id'] in await ancestors(parent):
            raise HTTPException(400, "A folder can't go inside itself")
        change['parent_id'] = parent
    f = await db().my_folders.find_one_and_update({'_id': f['_id']}, {'$set': change}, return_document=True)
    return folder_out(f)


@router.delete('/folders/{fid}', status_code=204)
async def delete_folder(fid: str, u: User):
    f = await get_item('folder', fid, u, write=True)
    folders = await subtree(f['_id'])
    files = [x['_id'] async for x in db().my_files.find({'folder_id': {'$in': folders}}, {'_id': 1})]
    await db().my_shares.delete_many({'item_id': {'$in': folders + files}})
    await db().my_files.delete_many({'_id': {'$in': files}})
    await db().my_folders.delete_many({'_id': {'$in': folders}})


# ---------- files ----------
@router.post('/files', status_code=201)
async def add_file(body: FileIn, u: User):
    f = {'owner_id': u['_id'], 'name': body.name, 'folder_id': await own_folder(body.folder_id, u),
         'doc': body.doc, 'text': body.text, 'preview': preview(body.text), 'created_at': now(), 'updated_at': now()}
    f['_id'] = (await db().my_files.insert_one(f)).inserted_id
    return file_meta(f)


@router.get('/files/{fid}')
async def get_file(fid: str, u: User):
    f = await get_item('file', fid, u)
    mine = f['owner_id'] == u['_id']
    return {**file_meta(f), 'doc': f.get('doc'), 'can_edit': mine,
            'owner': person(u if mine else await db().users.find_one({'_id': f['owner_id']}))}


@router.patch('/files/{fid}')
async def edit_file(fid: str, body: FilePatch, u: User):
    f = await get_item('file', fid, u, write=True)
    change = {'updated_at': now()}
    if body.name is not None:
        change['name'] = body.name
    if 'folder_id' in body.model_fields_set:
        change['folder_id'] = await own_folder(body.folder_id, u)
    if body.doc is not None:
        change['doc'] = body.doc
    if body.text is not None:
        change |= {'text': body.text, 'preview': preview(body.text)}
    f = await db().my_files.find_one_and_update({'_id': f['_id']}, {'$set': change}, return_document=True)
    return file_meta(f)


@router.delete('/files/{fid}', status_code=204)
async def delete_file(fid: str, u: User):
    f = await get_item('file', fid, u, write=True)
    await db().my_shares.delete_many({'item_id': f['_id']})
    await db().my_files.delete_one({'_id': f['_id']})


@router.post('/files/{fid}/copy', status_code=201)
async def copy_file(fid: str, u: User):
    # Your own note is duplicated next to the original; a note shared with you is copied to your top level.
    f = await get_item('file', fid, u)
    mine = f['owner_id'] == u['_id']
    copy = {'owner_id': u['_id'], 'name': f"{f['name']} (copy)" if mine else f['name'],
            'folder_id': f.get('folder_id') if mine else None, 'doc': f.get('doc'), 'text': f.get('text', ''),
            'preview': f.get('preview', ''), 'created_at': now(), 'updated_at': now()}
    copy['_id'] = (await db().my_files.insert_one(copy)).inserted_id
    return file_meta(copy)


# ---------- sharing (view only) ----------
def share_out(s: dict, who: dict | None) -> dict:
    return {'id': str(s['_id']), 'user': person(who), 'created_at': s['created_at']}


@router.get('/shares')
async def list_shares(kind: str, item_id: str, u: User):
    if kind not in NOT_FOUND:
        raise HTTPException(400, 'Unknown kind')
    item = await get_item(kind, item_id, u, write=True)
    shares = [s async for s in db().my_shares.find({'item_id': item['_id']}).sort('created_at', 1)]
    users = {x['_id']: x async for x in db().users.find({'_id': {'$in': [s['user_id'] for s in shares]}}, {'name': 1, 'email': 1})}
    return [share_out(s, users.get(s['user_id'])) for s in shares]


@router.post('/shares', status_code=201)
async def add_share(body: ShareIn, u: User):
    item = await get_item(body.kind, body.item_id, u, write=True)
    who = await db().users.find_one({'email': body.email}, {'name': 1, 'email': 1})
    if not who:
        raise HTTPException(404, 'No user with that email')
    if who['_id'] == u['_id']:
        raise HTTPException(400, "That's you. Your notes are already yours.")
    s = {'owner_id': u['_id'], 'kind': body.kind, 'item_id': item['_id'], 'user_id': who['_id'], 'created_at': now()}
    try:
        s['_id'] = (await db().my_shares.insert_one(s)).inserted_id
    except DuplicateKeyError:   # already shared with them: not an error
        s = await db().my_shares.find_one({'item_id': item['_id'], 'user_id': who['_id']})
    return share_out(s, who)


@router.delete('/shares/{share_id}', status_code=204)
async def remove_share(share_id: str, u: User):
    # The owner can stop sharing; the person it was shared with can remove it from their list.
    try:
        _id = ObjectId(share_id)
    except InvalidId:
        raise HTTPException(404, 'Share not found')
    await db().my_shares.delete_one({'_id': _id, '$or': [{'owner_id': u['_id']}, {'user_id': u['_id']}]})


# ---------- shared with me ----------
@router.get('/shared')
async def shared_with_me(u: User):
    shares = [s async for s in db().my_shares.find({'user_id': u['_id']}).sort('created_at', -1)]
    ids = [s['item_id'] for s in shares]
    items = {f['_id']: ('folder', f) async for f in db().my_folders.find({'_id': {'$in': ids}}, {'name': 1, 'owner_id': 1, 'updated_at': 1})}
    items |= {f['_id']: ('file', f) async for f in db().my_files.find({'_id': {'$in': ids}}, {'name': 1, 'owner_id': 1, 'updated_at': 1})}
    owners = {x['_id']: x async for x in db().users.find({'_id': {'$in': list({s['owner_id'] for s in shares})}}, {'name': 1, 'email': 1})}
    return [{'share_id': str(s['_id']), 'kind': items[s['item_id']][0], 'id': str(s['item_id']),
             'name': items[s['item_id']][1]['name'], 'updated_at': items[s['item_id']][1]['updated_at'],
             'owner': person(owners.get(s['owner_id']))}
            for s in shares if s['item_id'] in items]


@router.get('/shared/folders/{fid}')
async def shared_folder(fid: str, u: User):
    f = await get_item('folder', fid, u)
    ids = await subtree(f['_id'])
    folders = [folder_out(x) async for x in db().my_folders.find({'_id': {'$in': ids}}).sort('name', 1)]
    files = [file_meta(x) async for x in db().my_files.find({'folder_id': {'$in': ids}}, {'doc': 0, 'text': 0}).sort('name', 1)]
    owner = await db().users.find_one({'_id': f['owner_id']}, {'name': 1, 'email': 1})
    return {'root': str(f['_id']), 'folders': folders, 'files': files, 'owner': person(owner),
            'can_edit': f['owner_id'] == u['_id']}

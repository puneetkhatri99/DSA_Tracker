import {
  CaretRightIcon, ClipboardTextIcon, DotsThreeIcon, EyeIcon, FilePlusIcon, FileTextIcon, FolderIcon, FolderPlusIcon, MagnifyingGlassIcon,
  NotebookIcon, PencilSimpleIcon, ShareNetworkIcon, SidebarSimpleIcon, TrashIcon, UsersIcon,
} from '@phosphor-icons/react';
import { Fragment, type ReactNode, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { Loader } from '../components/Loader';
import { type Actions, matching, MyTree, SharedList } from '../components/notes/FolderTree';
import { Menu } from '../components/notes/Menu';
import { NoteEditor } from '../components/notes/NoteEditor';
import { Confirm, ShareDialog } from '../components/notes/ShareDialog';
import { ago, type NbFile, type NbFileMeta, type NbFolder, type NbItem, type NbShared, type NbSharedItem, type NbTree } from '../lib';
import { useStore } from '../store';

const OPEN_KEY = 'my-notes-open';
const loadOpen = () => { try { return new Set<string>(JSON.parse(localStorage.getItem(OPEN_KEY) || '[]')); } catch { return new Set<string>(); } };

// Folders from the top down to (and including) folder id.
function pathTo(tree: NbTree, id: string | null) {
  const out: NbFolder[] = [];
  while (id && out.length < 32) {
    const f = tree.folders.find(x => x.id === id);
    if (!f) break;
    out.unshift(f);
    id = f.parent_id;
  }
  return out;
}

function Crumbs({ tree, folder }: { tree: NbTree; folder: string | null }) {
  return <nav aria-label="Folder path"><Link to="/my-notes">My notes</Link>
    {pathTo(tree, folder).map(f => <Fragment key={f.id}><CaretRightIcon /><Link to={`/my-notes/d/${f.id}`}>{f.name}</Link></Fragment>)}</nav>;
}

function FileCard({ f, owner }: { f: NbFileMeta; owner?: string }) {
  return <Link className="nb-card" to={`/my-notes/f/${f.id}`}>
    <span className="nb-card-title"><FileTextIcon />{f.name}</span>
    <span className="nb-card-preview">{f.preview || 'Empty note'}</span>
    <small>{owner ? `${owner} · ` : ''}{ago(f.updated_at)}</small>
  </Link>;
}

function FolderCard({ f, tree }: { f: NbFolder; tree: NbTree }) {
  const n = tree.folders.filter(x => x.parent_id === f.id).length + tree.files.filter(x => x.folder_id === f.id).length;
  return <Link className="nb-card folder" to={`/my-notes/d/${f.id}`}>
    <span className="nb-card-title"><FolderIcon />{f.name}</span>
    <small>{n ? `${n} item${n > 1 ? 's' : ''}` : 'Empty'}</small>
  </Link>;
}

function Grid({ folders, files, tree, owner }: { folders: NbFolder[]; files: NbFileMeta[]; tree: NbTree; owner?: string }) {
  return <div className="nb-grid">
    {folders.map(f => <FolderCard key={f.id} f={f} tree={tree} />)}
    {files.map(f => <FileCard key={f.id} f={f} owner={owner} />)}
  </div>;
}

function Home({ tree, shared, act }: { tree: NbTree; shared: NbSharedItem[]; act: Actions }) {
  const recent = [...tree.files].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 9);
  return <>
    <div className="nb-head">
      <div className="nb-title-row">
        <h1 className="nb-title">My notes</h1>
        <div className="nb-actions">
          <button className="btn" onClick={() => act.newFolder(null)}><FolderPlusIcon />New folder</button>
          <button className="primary" onClick={() => act.newFile(null)}><FilePlusIcon />New note</button>
        </div>
      </div>
      <p className="nb-lede">Keep what you learn, organised in folders. Saved automatically.</p>
    </div>
    {!tree.files.length && !tree.folders.length
      ? <div className="nb-tips">
        <div><FolderPlusIcon /><b>One folder per topic</b><span>Graphs, DP, System design… folders can hold folders too. Drag to reorganise.</span></div>
        <div><ClipboardTextIcon /><b>Paste from ChatGPT or Claude</b><span>Headings, code, tables and equations come through as they look, whether you select the text or use their Copy button.</span></div>
        <div><ShareNetworkIcon /><b>Share with friends</b><span>Select a folder or note and click Share. They can read and copy it, not change it.</span></div>
      </div>
      : <>
        {recent.length > 0 && <><h2 className="nb-sub">Recently edited</h2><Grid folders={[]} files={recent} tree={tree} /></>}
        {!recent.length && <><h2 className="nb-sub">Folders</h2><Grid folders={tree.folders.filter(f => !f.parent_id)} files={[]} tree={tree} /></>}
      </>}
    {shared.length > 0 && <>
      <h2 className="nb-sub"><UsersIcon />Shared with me</h2>
      <div className="nb-grid">{shared.map(s => s.kind === 'file'
        ? <FileCard key={s.share_id} f={{ id: s.id, name: s.name, folder_id: null, preview: '', updated_at: s.updated_at }} owner={s.owner.name} />
        : <Link key={s.share_id} className="nb-card folder" to={`/my-notes/d/${s.id}`}>
          <span className="nb-card-title"><FolderIcon />{s.name}</span><small>{s.owner.name} · {ago(s.updated_at)}</small>
        </Link>)}
      </div>
    </>}
  </>;
}

function FolderView({ id, tree, act, rename }: { id: string; tree: NbTree; act: Actions; rename: (id: string) => void }) {
  const own = tree.folders.some(f => f.id === id);
  const [shared, setShared] = useState<NbShared>();
  const [error, setError] = useState('');
  useEffect(() => {
    setShared(undefined); setError('');
    if (!own) api<NbShared>(`/my-notes/shared/folders/${id}`).then(setShared, e => setError(e.message));
  }, [id, own]);
  if (error) return <Missing text={error} />;
  const src = own ? tree : shared;
  if (!src) return <Loader label="Loading folder…" />;
  const folder = src.folders.find(f => f.id === id)!;
  const folders = src.folders.filter(f => f.parent_id === id);
  const files = src.files.filter(f => f.folder_id === id);
  const item: NbItem = { kind: 'folder', id, name: folder.name };
  return <>
    <div className="nb-head">
      <div className="nb-crumbs">{own ? <Crumbs tree={tree} folder={folder.parent_id} /> : <span><UsersIcon />Shared by {shared!.owner.name}</span>}</div>
      <div className="nb-title-row">
        <h1 className="nb-title"><FolderIcon className="nb-title-icon" />{folder.name}</h1>
        {own && <div className="nb-actions">
          <button className="btn" onClick={() => act.share(item)}><ShareNetworkIcon />Share</button>
          <button className="btn" onClick={() => act.newFolder(id)}><FolderPlusIcon />New folder</button>
          <button className="primary" onClick={() => act.newFile(id)}><FilePlusIcon />New note</button>
          <Menu label="More" trigger={<DotsThreeIcon weight="bold" />}>
            <button onClick={() => rename(id)}><PencilSimpleIcon />Rename</button>
            <button className="danger" onClick={() => act.remove(item)}><TrashIcon />Delete folder</button>
          </Menu>
        </div>}
      </div>
      {!own && <p className="nb-viewonly"><EyeIcon />View only · shared by <b>{shared!.owner.name}</b> ({shared!.owner.email})</p>}
    </div>
    {folders.length || files.length
      ? <Grid folders={folders} files={files} tree={src} owner={own ? undefined : shared!.owner.name} />
      : <div className="nb-empty"><NotebookIcon /><p>This folder is empty.</p>
        {own && <button className="primary" onClick={() => act.newFile(id)}><FilePlusIcon />New note</button>}</div>}
  </>;
}

function FileView({ id, tree, fresh, act, onSaved }: { id: string; tree: NbTree; fresh: boolean; act: Actions; onSaved: (m: NbFileMeta) => void }) {
  const [file, setFile] = useState<NbFile>();
  const [error, setError] = useState('');
  useEffect(() => {
    setFile(undefined); setError('');
    api<NbFile>(`/my-notes/files/${id}`).then(setFile, e => setError(e.message));
  }, [id]);
  if (error) return <Missing text={error} />;
  if (!file) return <Loader label="Opening note…" />;
  const meta = tree.files.find(f => f.id === id);   // the tree has the latest name and folder after a rename or a move
  const current = { ...file, name: meta?.name ?? file.name, folder_id: meta ? meta.folder_id : file.folder_id };
  const item: NbItem = { kind: 'file', id, name: current.name };
  return <NoteEditor key={file.id} file={current} fresh={fresh} onSaved={onSaved}
    crumbs={file.can_edit ? <Crumbs tree={tree} folder={current.folder_id} /> : <span><UsersIcon />Shared with you</span>}
    onShare={() => act.share(item)} onCopy={() => act.duplicate(id)} onDelete={() => act.remove(item)} />;
}

const Missing = ({ text }: { text: string }) => <div className="nb-empty"><NotebookIcon /><p>{text}</p><Link className="btn" to="/my-notes">Back to my notes</Link></div>;

export default function MyNotes() {
  const { showStatus } = useStore();
  const navigate = useNavigate();
  const [kind, id] = (useParams()['*'] || '').split('/');
  const selected = (kind === 'f' || kind === 'd') && id ? id : undefined;
  const [tree, setTree] = useState<NbTree>();
  const [shared, setShared] = useState<NbSharedItem[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(loadOpen);
  const [q, setQ] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [sharing, setSharing] = useState<NbItem | null>(null);
  const [deleting, setDeleting] = useState<NbItem | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  const load = useCallback(() => Promise.all([api<NbTree>('/my-notes/tree'), api<NbSharedItem[]>('/my-notes/shared')])
    .then(([t, s]) => { setTree(t); setShared(s); }, e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDrawer(false); }, [kind, id]);
  useEffect(() => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...open])); } catch { /* private mode */ } }, [open]);

  const toggle = useCallback((fid: string, force?: boolean) => setOpen(o => {
    const on = force ?? !o.has(fid);
    if (on === o.has(fid)) return o;
    const n = new Set(o);
    if (on) n.add(fid); else n.delete(fid);
    return n;
  }), []);

  // Opening a note or folder unfolds the folders above it.
  useEffect(() => {
    if (!tree || !selected) return;
    const folder = kind === 'f' ? tree.files.find(f => f.id === selected)?.folder_id ?? null : tree.folders.find(f => f.id === selected)?.parent_id ?? null;
    const missing = pathTo(tree, folder).filter(f => !open.has(f.id));
    if (missing.length) setOpen(o => new Set([...o, ...missing.map(f => f.id)]));
  }, [tree, selected, kind]);   // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (e: Error) => showStatus(e.message, true);
  const patchTree = (f: (t: NbTree) => NbTree) => setTree(t => (t ? f(t) : t));
  const putFile = (m: NbFileMeta) => patchTree(t => ({ ...t, files: t.files.some(x => x.id === m.id) ? t.files.map(x => (x.id === m.id ? m : x)) : [...t.files, m] }));
  const putFolder = (m: NbFolder) => patchTree(t => ({ ...t, folders: t.folders.some(x => x.id === m.id) ? t.folders.map(x => (x.id === m.id ? m : x)) : [...t.folders, m] }));

  const act: Actions = {
    newFile: folder => api<NbFileMeta>('/my-notes/files', { method: 'POST', body: { name: 'Untitled', folder_id: folder } })
      .then(m => { putFile(m); setFresh(m.id); navigate(`/my-notes/f/${m.id}`); }, fail),
    newFolder: parent => api<NbFolder>('/my-notes/folders', { method: 'POST', body: { name: 'New folder', parent_id: parent } })
      .then(f => { putFolder(f); if (parent) toggle(parent, true); setDrawer(true); setRenaming(f.id); }, fail),
    rename: (k, rid, name) => api<NbFolder & NbFileMeta>(`/my-notes/${k}s/${rid}`, { method: 'PATCH', body: { name } })
      .then(m => (k === 'file' ? putFile(m) : putFolder(m)), fail),
    move: (k, mid, folder) => {
      const cur = k === 'file' ? tree?.files.find(f => f.id === mid)?.folder_id : tree?.folders.find(f => f.id === mid)?.parent_id;
      if (cur === undefined || cur === folder) return;
      api<NbFolder & NbFileMeta>(`/my-notes/${k}s/${mid}`, { method: 'PATCH', body: k === 'file' ? { folder_id: folder } : { parent_id: folder } })
        .then(m => {
          if (k === 'file') putFile(m); else putFolder(m);
          showStatus(`Moved to ${folder ? tree?.folders.find(f => f.id === folder)?.name : 'the top level'}`);
        }, fail);
    },
    remove: item => setDeleting(item),
    duplicate: did => api<NbFileMeta>(`/my-notes/files/${did}/copy`, { method: 'POST' })
      .then(m => { putFile(m); showStatus('Copied to My notes'); navigate(`/my-notes/f/${m.id}`); }, fail),
    share: item => setSharing(item),
    unshare: s => api(`/my-notes/shares/${s.share_id}`, { method: 'DELETE' }).then(() => {
      setShared(list => list.filter(x => x.share_id !== s.share_id));
      if (selected === s.id) navigate('/my-notes');
    }, fail),
  };

  const confirmDelete = async (ok: boolean) => {
    const item = deleting!;
    setDeleting(null);
    if (!ok || !tree) return;
    try {
      await api(`/my-notes/${item.kind}s/${item.id}`, { method: 'DELETE' });
      // If what's on screen was deleted (or sat inside the deleted folder), go up to where it was.
      const selFolder = kind === 'f' ? tree.files.find(f => f.id === selected)?.folder_id ?? null : selected ?? null;
      const parent = item.kind === 'file' ? tree.files.find(f => f.id === item.id)?.folder_id : tree.folders.find(f => f.id === item.id)?.parent_id;
      if (selected === item.id || (item.kind === 'folder' && pathTo(tree, selFolder).some(f => f.id === item.id)))
        navigate(parent ? `/my-notes/d/${parent}` : '/my-notes');
      showStatus(`Deleted “${item.name}”`);
      await load();
    } catch (e) {
      fail(e as Error);
    }
  };

  if (error) return <Missing text={`Couldn't load your notes: ${error}`} />;
  if (!tree) return <Loader page label="Loading your notes…" />;
  const counts = { folders: tree.folders.length, files: tree.files.length };
  const deletingCount = deleting?.kind === 'folder' ? tree.files.filter(f => pathTo(tree, f.folder_id).some(p => p.id === deleting.id)).length : 0;

  return (
    <div className={`mynotes ${drawer ? 'drawer' : ''}`}>
      <aside className="nb-side" aria-label="Folders">
        <label className="nb-search">
          <MagnifyingGlassIcon />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${counts.files} note${counts.files === 1 ? '' : 's'}`} aria-label="Search notes" />
        </label>
        <MyTree tree={tree} selected={selected} open={open} toggle={toggle} visible={matching(tree, q)} renaming={renaming} setRenaming={setRenaming} act={act} />
        <SharedList items={shared} selected={selected} open={open} toggle={toggle} act={act} />
      </aside>
      <button className="nb-backdrop" aria-label="Close folders" tabIndex={drawer ? 0 : -1} onClick={() => setDrawer(false)} />
      <section className="nb-main">
        <button className="btn nb-drawer-btn" onClick={() => setDrawer(true)}><SidebarSimpleIcon />Folders</button>
        {kind === 'f' && selected ? <FileView key={selected} id={selected} tree={tree} fresh={fresh === selected} act={act} onSaved={putFile} />
          : kind === 'd' && selected ? <FolderView key={selected} id={selected} tree={tree} act={act} rename={rid => { setDrawer(true); setRenaming(rid); }} />
            : <Home tree={tree} shared={shared} act={act} />}
      </section>
      {sharing && <ShareDialog item={sharing} onClose={() => setSharing(null)} />}
      {deleting && <Confirm title={`Delete “${deleting.name}”?`} action="Delete" onDone={confirmDelete}
        text={deleting.kind === 'folder'
          ? <>This deletes the folder, everything inside it{deletingCount ? <> (<b>{deletingCount} note{deletingCount > 1 ? 's' : ''}</b>)</> : null}, and stops sharing it. This can't be undone.</>
          : <>This deletes the note for you and anyone you shared it with. This can't be undone.</>} />}
    </div>
  );
}

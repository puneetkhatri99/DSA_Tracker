import {
  CaretRightIcon, CopySimpleIcon, DotsThreeIcon, FilePlusIcon, FileTextIcon, FolderIcon, FolderOpenIcon, FolderPlusIcon,
  PencilSimpleIcon, ShareNetworkIcon, TrashIcon, UsersIcon, XIcon,
} from '@phosphor-icons/react';
import { type CSSProperties, type DragEvent, type ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api';
import type { NbFileMeta, NbFolder, NbItem, NbKind, NbShared, NbSharedItem, NbTree } from '../../lib';
import { Loader } from '../Loader';
import { Menu } from './Menu';

export interface Actions {
  newFile: (folder: string | null) => void;
  newFolder: (parent: string | null) => void;
  rename: (kind: NbKind, id: string, name: string) => void;
  move: (kind: NbKind, id: string, folder: string | null) => void;
  remove: (item: NbItem) => void;
  duplicate: (id: string) => void;
  share: (item: NbItem) => void;
  unshare: (s: NbSharedItem) => void;
}
interface Ctx {
  tree: NbTree; selected?: string; open: Set<string>; toggle: (id: string, open?: boolean) => void;
  visible: Set<string> | null; readOnly?: boolean; renaming: string | null; setRenaming: (id: string | null) => void; act: Actions;
}

const DRAG = 'application/x-dsa-note';
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

// When searching: the files whose name or text matches, the folders whose name matches, and every folder above them.
export function matching(tree: NbTree, q: string): Set<string> | null {
  q = q.trim().toLowerCase();
  if (!q) return null;
  const parent = new Map(tree.folders.map(f => [f.id, f.parent_id]));
  const out = new Set<string>();
  const up = (id: string | null) => { while (id && !out.has(id)) { out.add(id); id = parent.get(id) ?? null; } };
  tree.folders.forEach(f => { if (f.name.toLowerCase().includes(q)) up(f.id); });
  tree.files.forEach(f => {
    if (f.name.toLowerCase().includes(q) || f.preview.toLowerCase().includes(q)) { out.add(f.id); up(f.folder_id); }
  });
  return out;
}

function useDrop(onDrop: (kind: NbKind, id: string) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => { if (e.dataTransfer.types.includes(DRAG)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); } },
      onDragLeave: (e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); },
      onDrop: (e: DragEvent) => {
        setOver(false);
        const raw = e.dataTransfer.getData(DRAG);
        if (!raw) return;
        e.preventDefault();
        const { kind, id } = JSON.parse(raw) as { kind: NbKind; id: string };
        onDrop(kind, id);
      },
    },
  };
}

const dragProps = (kind: NbKind, id: string, can: boolean) => can ? {
  draggable: true,
  onDragStart: (e: DragEvent) => { e.dataTransfer.setData(DRAG, JSON.stringify({ kind, id })); e.dataTransfer.effectAllowed = 'move'; },
} : {};

function RenameInput({ value, onDone }: { value: string; onDone: (name: string | null) => void }) {
  const [v, setV] = useState(value);
  return <input className="nb-rename" value={v} autoFocus aria-label="New name" maxLength={200}
    onFocus={e => e.target.select()} onChange={e => setV(e.target.value)}
    onBlur={() => onDone(v.trim() && v.trim() !== value ? v.trim() : null)}
    onKeyDown={e => {
      if (e.key === 'Enter') e.currentTarget.blur();
      if (e.key === 'Escape') { e.stopPropagation(); setV(value); onDone(null); }
    }} />;
}

function Row({ depth, active, className = '', children, drop, drag }:
  { depth: number; active?: boolean; className?: string; children: ReactNode; drop?: ReturnType<typeof useDrop>; drag?: object }) {
  return <div className={`nb-row ${className} ${active ? 'active' : ''} ${drop?.over ? 'drop' : ''}`}
    style={{ '--depth': depth } as CSSProperties} {...drop?.props} {...drag}>{children}</div>;
}

function FolderNode({ f, depth, c }: { f: NbFolder; depth: number; c: Ctx }) {
  const isOpen = !!c.visible || c.open.has(f.id);
  const drop = useDrop((kind, id) => { if (id !== f.id) { c.act.move(kind, id, f.id); c.toggle(f.id, true); } });
  const item: NbItem = { kind: 'folder', id: f.id, name: f.name };
  return (
    <li role="treeitem" aria-expanded={isOpen} aria-selected={c.selected === f.id}>
      <Row depth={depth} active={c.selected === f.id} drop={c.readOnly ? undefined : drop} drag={dragProps('folder', f.id, !c.readOnly && c.renaming !== f.id)}>
        <button className="caret" aria-label={isOpen ? 'Collapse' : 'Expand'} tabIndex={-1} onClick={() => c.toggle(f.id)}><CaretRightIcon weight="bold" /></button>
        {c.renaming === f.id
          ? <><FolderOpenIcon className="kind" /><RenameInput value={f.name} onDone={n => { c.setRenaming(null); if (n) c.act.rename('folder', f.id, n); }} /></>
          : <Link to={`/my-notes/d/${f.id}`} onClick={() => c.toggle(f.id, true)} onDoubleClick={() => !c.readOnly && c.setRenaming(f.id)}
            onKeyDown={e => { if (e.key === 'F2' && !c.readOnly) c.setRenaming(f.id); }}>
            {isOpen ? <FolderOpenIcon className="kind" /> : <FolderIcon className="kind" />}<span>{f.name}</span>
          </Link>}
        {!c.readOnly && <Menu label={`Actions for ${f.name}`} trigger={<DotsThreeIcon weight="bold" />}>
          <button onClick={() => { c.toggle(f.id, true); c.act.newFile(f.id); }}><FilePlusIcon />New note here</button>
          <button onClick={() => { c.toggle(f.id, true); c.act.newFolder(f.id); }}><FolderPlusIcon />New folder inside</button>
          <button onClick={() => c.setRenaming(f.id)}><PencilSimpleIcon />Rename<kbd>F2</kbd></button>
          <button onClick={() => c.act.share(item)}><ShareNetworkIcon />Share</button>
          {f.parent_id && <button onClick={() => c.act.move('folder', f.id, null)}><FolderIcon />Move to top level</button>}
          <button className="danger" onClick={() => c.act.remove(item)}><TrashIcon />Delete</button>
        </Menu>}
      </Row>
      {isOpen && <Branch parent={f.id} depth={depth + 1} c={c} />}
    </li>
  );
}

function FileNode({ f, depth, c }: { f: NbFileMeta; depth: number; c: Ctx }) {
  const item: NbItem = { kind: 'file', id: f.id, name: f.name };
  return (
    <li role="treeitem" aria-selected={c.selected === f.id}>
      <Row depth={depth} active={c.selected === f.id} className="file" drag={dragProps('file', f.id, !c.readOnly && c.renaming !== f.id)}>
        {c.renaming === f.id
          ? <><FileTextIcon className="kind" /><RenameInput value={f.name} onDone={n => { c.setRenaming(null); if (n) c.act.rename('file', f.id, n); }} /></>
          : <Link to={`/my-notes/f/${f.id}`} onDoubleClick={() => !c.readOnly && c.setRenaming(f.id)}
            onKeyDown={e => { if (e.key === 'F2' && !c.readOnly) c.setRenaming(f.id); }}>
            <FileTextIcon className="kind" /><span>{f.name}</span>
          </Link>}
        {!c.readOnly && <Menu label={`Actions for ${f.name}`} trigger={<DotsThreeIcon weight="bold" />}>
          <button onClick={() => c.setRenaming(f.id)}><PencilSimpleIcon />Rename<kbd>F2</kbd></button>
          <button onClick={() => c.act.duplicate(f.id)}><CopySimpleIcon />Duplicate</button>
          <button onClick={() => c.act.share(item)}><ShareNetworkIcon />Share</button>
          {f.folder_id && <button onClick={() => c.act.move('file', f.id, null)}><FolderIcon />Move to top level</button>}
          <button className="danger" onClick={() => c.act.remove(item)}><TrashIcon />Delete</button>
        </Menu>}
      </Row>
    </li>
  );
}

function Branch({ parent, depth, c }: { parent: string | null; depth: number; c: Ctx }) {
  const show = (id: string) => !c.visible || c.visible.has(id);
  const folders = c.tree.folders.filter(f => f.parent_id === parent && show(f.id)).sort(byName);
  const files = c.tree.files.filter(f => f.folder_id === parent && show(f.id)).sort(byName);
  if (!folders.length && !files.length) return depth ? <p className="nb-empty-branch" style={{ '--depth': depth } as CSSProperties}>Empty</p> : null;
  return (
    <ul role={depth ? 'group' : 'tree'} aria-label={depth ? undefined : 'My notes'}>
      {folders.map(f => <FolderNode key={f.id} f={f} depth={depth} c={c} />)}
      {files.map(f => <FileNode key={f.id} f={f} depth={depth} c={c} />)}
    </ul>
  );
}

export function MyTree({ tree, selected, open, toggle, visible, renaming, setRenaming, act }: Omit<Ctx, 'readOnly'>) {
  const c: Ctx = { tree, selected, open, toggle, visible, renaming, setRenaming, act };
  const drop = useDrop((kind, id) => act.move(kind, id, null));
  return (
    <section className="nb-section">
      <div className={`nb-section-head ${drop.over ? 'drop' : ''}`} {...drop.props} title="Drop here to move to the top level">
        <h3>My notes</h3>
        <button className="icon" title="New folder" aria-label="New folder" onClick={() => act.newFolder(null)}><FolderPlusIcon /></button>
        <button className="icon" title="New note" aria-label="New note" onClick={() => act.newFile(null)}><FilePlusIcon /></button>
      </div>
      {tree.folders.length || tree.files.length
        ? visible?.size === 0 ? <p className="nb-hint">Nothing matches.</p> : <Branch parent={null} depth={0} c={c} />
        : <p className="nb-hint">No notes yet. Make a folder for a topic, then add notes to it.</p>}
    </section>
  );
}

// What other people shared with you. A shared folder opens into its own read-only tree.
function SharedFolder({ s, selected, open, toggle, act }: { s: NbSharedItem } & Pick<Ctx, 'selected' | 'open' | 'toggle' | 'act'>) {
  const [sub, setSub] = useState<NbShared>();
  const [error, setError] = useState('');
  const isOpen = open.has(s.id);
  useEffect(() => {
    if (isOpen && !sub) api<NbShared>(`/my-notes/shared/folders/${s.id}`).then(setSub, e => setError(e.message));
  }, [isOpen, s.id, sub]);
  const c: Ctx = { tree: sub || { folders: [], files: [] }, selected, open, toggle, visible: null, readOnly: true, renaming: null, setRenaming: () => {}, act };
  return (
    <li role="treeitem" aria-expanded={isOpen} aria-selected={selected === s.id}>
      <Row depth={0} active={selected === s.id}>
        <button className="caret" aria-label={isOpen ? 'Collapse' : 'Expand'} tabIndex={-1} onClick={() => toggle(s.id)}><CaretRightIcon weight="bold" /></button>
        <Link to={`/my-notes/d/${s.id}`} onClick={() => toggle(s.id, true)}>
          {isOpen ? <FolderOpenIcon className="kind" /> : <FolderIcon className="kind" />}<span>{s.name}</span><em>{s.owner.name}</em>
        </Link>
        <SharedMenu s={s} act={act} />
      </Row>
      {isOpen && (error ? <p className="nb-hint bad">{error}</p> : sub ? <Branch parent={s.id} depth={1} c={c} /> : <Loader label="Loading…" />)}
    </li>
  );
}

const SharedMenu = ({ s, act }: { s: NbSharedItem; act: Actions }) => (
  <Menu label={`Actions for ${s.name}`} trigger={<DotsThreeIcon weight="bold" />}>
    <p><b>Shared by {s.owner.name}</b><span>{s.owner.email}</span></p>
    {s.kind === 'file' && <button onClick={() => act.duplicate(s.id)}><CopySimpleIcon />Save a copy to my notes</button>}
    <button onClick={() => act.unshare(s)}><XIcon />Remove from my list</button>
  </Menu>
);

export function SharedList({ items, selected, open, toggle, act }: { items: NbSharedItem[] } & Pick<Ctx, 'selected' | 'open' | 'toggle' | 'act'>) {
  if (!items.length) return null;
  return (
    <section className="nb-section">
      <div className="nb-section-head"><h3><UsersIcon />Shared with me</h3></div>
      <ul role="tree" aria-label="Shared with me">
        {items.map(s => s.kind === 'folder'
          ? <SharedFolder key={s.share_id} s={s} selected={selected} open={open} toggle={toggle} act={act} />
          : <li key={s.share_id} role="treeitem" aria-selected={selected === s.id}>
            <Row depth={0} active={selected === s.id} className="file">
              <Link to={`/my-notes/f/${s.id}`}><FileTextIcon className="kind" /><span>{s.name}</span><em>{s.owner.name}</em></Link>
              <SharedMenu s={s} act={act} />
            </Row>
          </li>)}
      </ul>
    </section>
  );
}

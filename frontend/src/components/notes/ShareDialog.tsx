import { CheckIcon, FileTextIcon, FolderIcon, LinkSimpleIcon, UserCircleIcon, XIcon } from '@phosphor-icons/react';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import type { NbItem, NbShare } from '../../lib';
import { useStore } from '../../store';
import { Loader } from '../Loader';
import { copyText } from './extensions';

// A native <dialog>: focus stays inside, Esc closes it, and clicking the backdrop closes it.
export function Modal({ title, onClose, children, className = '' }: { title: ReactNode; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className={`modal ${className}`} onClose={onClose} onClick={e => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon" aria-label="Close" onClick={() => ref.current?.close()}><XIcon /></button>
      </div>
      {children}
    </dialog>
  );
}

export function Confirm({ title, text, action, onDone }: { title: string; text: ReactNode; action: string; onDone: (ok: boolean) => void }) {
  const answered = useRef(false);   // the confirm button also closes the dialog, which would answer "no" a moment later
  const answer = (ok: boolean) => { if (!answered.current) { answered.current = true; onDone(ok); } };
  return (
    <Modal title={title} onClose={() => answer(false)}>
      <p className="modal-text">{text}</p>
      <form method="dialog" className="modal-actions">
        <button className="btn" value="cancel">Cancel</button>
        <button className="primary danger" autoFocus onClick={() => answer(true)}>{action}</button>
      </form>
    </Modal>
  );
}

export function ShareDialog({ item, onClose }: { item: NbItem; onClose: () => void }) {
  const { showStatus } = useStore();
  const [people, setPeople] = useState<NbShare[]>();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);

  useEffect(() => {
    api<NbShare[]>(`/my-notes/shares?kind=${item.kind}&item_id=${item.id}`).then(setPeople, e => setError(e.message));
  }, [item.kind, item.id]);

  const share = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setError('');
    try {
      const s = await api<NbShare>('/my-notes/shares', { method: 'POST', body: { kind: item.kind, item_id: item.id, email } });
      setPeople(ps => (ps?.some(p => p.id === s.id) ? ps : [...(ps || []), s]));
      setEmail('');
      showStatus(`Shared with ${s.user.name}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const unshare = (s: NbShare) => api(`/my-notes/shares/${s.id}`, { method: 'DELETE' })
    .then(() => { setPeople(ps => ps?.filter(p => p.id !== s.id)); showStatus(`Stopped sharing with ${s.user.name}`); }, e => setError(e.message));
  const copyLink = () => copyText(`${location.origin}/my-notes/${item.kind === 'file' ? 'f' : 'd'}/${item.id}`).then(ok => {
    setLinked(ok); setTimeout(() => setLinked(false), 2000);
    showStatus(ok ? 'Link copied' : 'Copy failed', !ok);
  });

  return (
    <Modal className="share" onClose={onClose} title={<>{item.kind === 'folder' ? <FolderIcon /> : <FileTextIcon />}Share “{item.name}”</>}>
      <form className="share-form" onSubmit={share}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Their account email" aria-label="Email" autoFocus required />
        <button className="primary" disabled={busy || !email.trim()}>{busy ? 'Sharing…' : 'Share'}</button>
      </form>
      {error && <p className="form-error">{error}</p>}
      <p className="share-note">
        People you share with can <b>view and copy</b>, not edit.
        {item.kind === 'folder' && ' Everything in this folder is included, even notes you add later.'}
      </p>
      <h3>People with access</h3>
      {!people ? <Loader label="Loading…" /> : !people.length ? <p className="share-empty">Only you.</p> :
        <ul className="share-list">{people.map(p => (
          <li key={p.id}>
            <UserCircleIcon />
            <span><b>{p.user.name}</b><small>{p.user.email}</small></span>
            <em>Can view</em>
            <button className="icon" title={`Stop sharing with ${p.user.name}`} aria-label={`Stop sharing with ${p.user.name}`} onClick={() => unshare(p)}><XIcon /></button>
          </li>))}
        </ul>}
      <div className="modal-actions split">
        <button className="btn" onClick={copyLink}>{linked ? <><CheckIcon />Copied</> : <><LinkSimpleIcon />Copy link</>}</button>
        <form method="dialog"><button className="btn">Done</button></form>
      </div>
    </Modal>
  );
}

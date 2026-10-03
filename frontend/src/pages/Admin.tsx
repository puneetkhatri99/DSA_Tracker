import { CheckIcon, CopyIcon, TrashIcon, UserPlusIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Loader } from '../components/Loader';
import { useStore } from '../store';

interface Invite { code: string; expires_at: string; used_by: string | null }
const link = (code: string) => `${location.origin}/signup?code=${encodeURIComponent(code)}`;
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// Invite links: single use, valid for 7 days. Whoever opens one can create an account.
export default function Admin() {
  const { showStatus } = useStore();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const load = () => api<Invite[]>('/invites').then(setInvites, e => showStatus(e.message, true));
  useEffect(() => { load(); }, []);
  // The row's Copy button says whether it worked for a few seconds (the header status is hidden on phones).
  const [copied, setCopied] = useState<{ code: string; ok: boolean }>();
  const clear = useRef<number>(undefined);
  const copy = (code: string) => Promise.resolve().then(() => navigator.clipboard.writeText(link(code))).then(() => true, () => false).then(ok => {
    setCopied({ code, ok });
    clearTimeout(clear.current);
    clear.current = window.setTimeout(() => setCopied(undefined), 2500);
    showStatus(ok ? 'Link copied' : 'Copy failed; select the link and copy it yourself', !ok);
  });
  useEffect(() => () => clearTimeout(clear.current), []);
  const create = () => api<Invite>('/invites', { method: 'POST' }).then(i => { copy(i.code); load(); }, e => showStatus(e.message, true));
  const revoke = (code: string) => api(`/invites/${encodeURIComponent(code)}`, { method: 'DELETE' }).then(load, e => showStatus(e.message, true));
  const open = invites?.filter(i => !i.used_by) || [], used = invites?.filter(i => i.used_by) || [];
  return <>
    <section className="head">
      <div className="head-row"><h1>Invite people</h1><button className="primary" onClick={create}><UserPlusIcon />New invite link</button></div>
      <p className="lede">Each link creates one account and expires after 7 days. New people get their own progress and notes; roadmaps and study notes are shared, and only you can edit the notes.</p>
    </section>
    <section className="day">
      <h2>Open links <span>{open.length}</span></h2>
      {!invites ? <Loader label="Loading invite links…" /> : open.length ? <div className="card">{open.map(i => (
        <div className="invite" key={i.code}>
          <input readOnly value={link(i.code)} aria-label="Invite link" onFocus={e => e.target.select()} />
          <small>expires {date(i.expires_at)}</small>
          <button className={`btn copy ${copied?.code !== i.code ? '' : copied.ok ? 'done' : 'failed'}`} onClick={() => copy(i.code)}>
            {copied?.code !== i.code ? <><CopyIcon />Copy</> : copied.ok ? <><CheckIcon />Copied</> : <><XIcon />Copy failed</>}</button>
          <button className="icon" title="Revoke" aria-label="Revoke" onClick={() => revoke(i.code)}><TrashIcon /></button>
        </div>))}</div> : <p className="quiet">No open links. Make one and send it to the person you want to invite.</p>}
    </section>
    <p className="sr-only" aria-live="polite">{copied ? (copied.ok ? 'Invite link copied' : 'Copy failed') : ''}</p>
    {used.length > 0 && <section className="day">
      <h2>Joined recently <span>{used.length}</span></h2>
      <div className="card">{used.map(i => <div className="invite" key={i.code}><span>{i.used_by}</span></div>)}</div>
    </section>}
  </>;
}

import { FloppyDiskIcon, PencilSimpleIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, cacheNote, getNote } from '../api';
import { Markdown } from '../components/Markdown';
import type { Note, NoteRef } from '../lib';
import { useStore } from '../store';

// Everyone reads; the admin can edit a note (markdown with a live preview) or add one.
export default function Notes() {
  const { notes, setNotes, user, showStatus } = useStore();
  const navigate = useNavigate();
  const { id } = useParams();
  const ref = notes.find(n => n.id === id) || notes[0];
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Note | null>(null);   // non-null while editing or adding
  const [saving, setSaving] = useState(false);
  const sections = [...new Set(notes.map(n => n.section))].map(s => ({ section: s, items: notes.filter(n => n.section === s) }));

  useEffect(() => {
    if (!ref) return;
    setNote(null); setError(''); setDraft(null);
    getNote(ref.id).then(setNote, e => setError(e.message));
    window.scrollTo(0, 0);
  }, [ref?.id]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = { title: draft.title, section: draft.section, body: draft.body };
      const saved = await api<Note>(draft.id ? `/notes/${encodeURIComponent(draft.id)}` : '/notes', { method: draft.id ? 'PUT' : 'POST', body });
      cacheNote(saved);
      const index: NoteRef = { id: saved.id, title: saved.title, section: saved.section };
      setNotes(ns => (ns.some(n => n.id === saved.id) ? ns.map(n => (n.id === saved.id ? index : n)) : [...ns, index]));
      setNote(saved); setDraft(null);
      showStatus('Note saved');
      if (saved.id !== ref?.id) navigate(`/notes/${saved.id}`);
    } catch (e) {
      showStatus((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="notes">
      <aside>
        {sections.map(s => <Fragment key={s.section}><h3>{s.section}</h3>
          {s.items.map(n => <Link key={n.id} to={`/notes/${n.id}`} className={n.id === ref?.id && !(draft && !draft.id) ? 'active' : ''}>{n.title}</Link>)}</Fragment>)}
        {user.is_admin && <button className="text-btn new-note" onClick={() => setDraft({ id: '', title: '', section: ref?.section || '', body: '' })}>
          <PlusIcon />New note</button>}
      </aside>
      <div className="note-main">
        {draft ? <div className="editor">
          <div className="editor-bar">
            <input value={draft.title} placeholder="Title" aria-label="Title" onChange={e => setDraft({ ...draft, title: e.target.value })} />
            <input value={draft.section} placeholder="Section" aria-label="Section" list="sections" onChange={e => setDraft({ ...draft, section: e.target.value })} />
            <datalist id="sections">{sections.map(s => <option key={s.section} value={s.section} />)}</datalist>
            <button className="btn" onClick={() => setDraft(null)}><XIcon />Cancel</button>
            <button className="primary" disabled={saving || !draft.title.trim() || !draft.section.trim()} onClick={save}><FloppyDiskIcon />{saving ? 'Saving…' : 'Save'}</button>
          </div>
          <div className="editor-panes">
            <textarea className="md-src" value={draft.body} spellCheck={false} aria-label="Markdown" placeholder="# Title&#10;&#10;Write markdown here."
              onChange={e => setDraft({ ...draft, body: e.target.value })} />
            <Markdown body={draft.body} />
          </div>
        </div> : <>
          {user.is_admin && note && <div className="note-tools"><button className="btn" onClick={() => setDraft(note)}><PencilSimpleIcon />Edit note</button></div>}
          {error ? <p className="bad">{error}</p> : note ? <Markdown body={note.body} /> : <article className="md"><p className="quiet">Loading…</p></article>}
        </>}
      </div>
    </div>
  );
}

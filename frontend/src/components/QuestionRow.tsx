import {
  ArrowCounterClockwiseIcon, ArticleIcon, CheckIcon, LockSimpleIcon, NotePencilIcon, PencilSimpleIcon, PlayCircleIcon, StarIcon, TimerIcon, XIcon,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { DIFF, HOW, daysUntil, hasSheetLC, isDue, lcFromInput, site, type How, type Question, type TopicStat } from '../lib';
import { useStore } from '../store';
import { javaHtml } from '../highlight';

// Jump to a topic on the roadmap page (lock chips name the topics a question builds on).
export function focusEl(el: HTMLElement | null) {
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1500);
}

export function Chip({ tid, stats }: { tid: string; stats: Record<string, TopicStat> }) {
  const { setOpenTopic } = useStore();
  const s = stats[tid];
  return (
    <button className={`chip ${s.met ? 'met' : ''}`} title={s.met ? 'Done' : `Builds on this topic (${s.done}/${s.total} solved)`}
      onClick={e => { e.preventDefault(); setOpenTopic(tid, true); focusEl(document.getElementById('t-' + tid)); }}>
      {s.met ? <CheckIcon /> : <LockSimpleIcon />}{s.title}
    </button>
  );
}

// Sheet links as chips. Questions with no LeetCode link get "+ LC": the link you add goes first and becomes the title link.
export function Links({ q, onOpen }: { q: Question; onOpen?: () => void }) {
  const { st, setQ, showStatus } = useStore();
  const lc = st(q.id).lc;
  const label = lc ? 'Edit your LeetCode link' : 'Add a LeetCode link';
  const ask = () => {
    const v = prompt(`LeetCode link for "${q.title}" (a slug like two-sum works too; leave blank to remove)`, lc || '');
    if (v === null) return;
    const url = lcFromInput(v);
    if (url === null) return showStatus('That is not a leetcode.com link.', true);
    setQ(q.id, { lc: url });
  };
  return (
    <span className="links">
      {[...(lc ? [['LC', lc]] : []), [site(q.url), q.url], ...Object.entries(q.alt || {})].map(([k, u]) =>
        <a key={k + u} href={u} target="_blank" rel="noopener" onClick={onOpen}>{k}</a>)}
      {!hasSheetLC(q) && <button onClick={ask} title={label} aria-label={label}>{lc ? <PencilSimpleIcon /> : '+ LC'}</button>}
    </span>
  );
}

function CodeBox({ id }: { id: string }) {
  const { st, setQ } = useStore();
  const code = st(id).code || '';
  const [editing, setEditing] = useState(!code);
  const box = useRef<HTMLTextAreaElement>(null);
  const clicked = useRef(false);
  useEffect(() => { if (editing && clicked.current) box.current?.focus(); }, [editing]);
  if (!editing) return (
    <pre className="code-view" title="Click to edit" onClick={() => { clicked.current = true; setEditing(true); }}>
      <code className="language-java hljs" dangerouslySetInnerHTML={{ __html: javaHtml(code) }} />
    </pre>
  );
  return (
    <textarea ref={box} className="code" spellCheck={false} placeholder="Your Java solution" aria-label="Java solution" defaultValue={code}
      onInput={e => setQ(id, { code: e.currentTarget.value })}
      onKeyDown={e => {
        if (e.key !== 'Tab' || e.shiftKey) return;   // Tab indents instead of leaving the box
        e.preventDefault();
        const t = e.currentTarget;
        t.setRangeText('    ', t.selectionStart, t.selectionEnd, 'end');
        setQ(id, { code: t.value });
      }}
      onBlur={e => { if (e.currentTarget.value.trim()) setEditing(false); }} />
  );
}

export function QuestionRow({ q, stats }: { q: Question; stats: Record<string, TopicStat> }) {
  const { st, setQ, solve, review, timer, startTimer, stopTimer, openNotes, setOpenNote } = useStore();
  const s = st(q.id);
  const locked = q.needs.some(n => !stats[n]?.met);
  const reviewDue = isDue(s);
  const next = !s.done || reviewDue ? '' : s.due ? `review in ${daysUntil(s.due)}d` : 'mastered';
  const info = [s.mins && `${s.mins} min`, next].filter(Boolean).join(' · ');
  const timing = timer?.id === q.id;
  const open = openNotes.has(q.id);
  const onOpen = () => { if (!timer && !s.done) startTimer(q.id); }; // opening an unsolved question starts its timer
  const toggleFlag = (k: 'rev' | 'star') => setQ(q.id, { [k]: !s[k] });
  return (
    <div className={`q ${s.done ? 'done' : ''} ${reviewDue ? 'due' : ''} ${locked && !s.done ? 'locked' : ''}`} data-id={q.id}>
      <input type="checkbox" checked={!!s.done} aria-label="Solved" onChange={e => {
        if (e.target.checked) solve(q.id, 'alone'); // "alone" until you pick otherwise in the row's dropdown
        else setQ(q.id, { done: '', lvl: 0, due: '', how: '', mins: 0 });
      }} />
      <a className="qt" href={s.lc || q.url} target="_blank" rel="noopener" onClick={onOpen}>{q.title}</a>
      <span className="meta">
        <span className={`diff ${q.diff}`}>{DIFF[q.diff]}</span>
        {q.tier === 'pro' && <span className="tag pro" title="Striver's Pro tier: harder or less often asked">Pro</span>}
        {q.premium && <span className="tag pro" title="LeetCode Premium">Premium</span>}
        <Links q={q} onOpen={onOpen} />
        {q.needs.length > 0 && <span className="needs">{q.needs.map(n => <Chip key={n} tid={n} stats={stats} />)}</span>}
      </span>
      <span className="acts">
        {/* How it went sets the next review, so changing it later reschedules the question. */}
        {s.done && <select className="select how" aria-label="How did it go?" value={s.how || 'alone'}
          onChange={e => solve(q.id, e.target.value as How)}>
          {(Object.keys(HOW) as How[]).map(k => <option key={k} value={k}>{HOW[k]}</option>)}</select>}
        {reviewDue && <span className="review">Review due
          <button data-act="recall" onClick={() => review(q.id, true)}><CheckIcon />Remembered</button>
          <button data-act="forgot" onClick={() => review(q.id, false)}><XIcon />Forgot</button></span>}
        {info && <small title={`Solved ${s.done}${s.due ? ', next review ' + s.due : ''}`}>{info}</small>}
        <button className={`icon ${timing ? 'on' : ''}`} data-act="timer" title={timing ? 'Stop timer' : 'Start timer'} aria-label={timing ? 'Stop timer' : 'Start timer'}
          onClick={() => (timing ? stopTimer() : startTimer(q.id))}><TimerIcon /></button>
        {q.video && <a className="icon" href={q.video} target="_blank" rel="noopener" title="Video solution" aria-label="Video solution"><PlayCircleIcon /></a>}
        {q.article && <a className="icon" href={q.article} target="_blank" rel="noopener" title="Article" aria-label="Article"><ArticleIcon /></a>}
        <button className={`icon ${s.rev ? 'on' : ''}`} data-act="rev" title="Mark to revise" aria-label="Mark to revise" aria-pressed={!!s.rev}
          onClick={() => toggleFlag('rev')}><ArrowCounterClockwiseIcon /></button>
        <button className={`icon ${s.star ? 'on' : ''}`} data-act="star" title="Star" aria-label="Star" aria-pressed={!!s.star}
          onClick={() => toggleFlag('star')}><StarIcon weight={s.star ? 'fill' : 'regular'} /></button>
        <button className={`icon ${s.note || s.code ? 'on' : ''}`} data-act="note" title="My notes and code" aria-label="My notes and code" aria-expanded={open}
          onClick={() => setOpenNote(q.id, !open)}><NotePencilIcon /></button>
      </span>
      {open && <div className="panel">
        <textarea data-field="note" autoFocus placeholder="Approach, complexity, gotchas" aria-label="Notes" defaultValue={s.note || ''}
          onInput={e => setQ(q.id, { note: e.currentTarget.value })} />
        <CodeBox id={q.id} />
      </div>}
    </div>
  );
}

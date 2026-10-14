import { ArrowRightIcon, BellRingingIcon, BookOpenTextIcon, CaretRightIcon, CheckIcon, FunnelSimpleIcon, GraphIcon, MagnifyingGlassIcon, TimerIcon } from '@phosphor-icons/react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useDueCount } from '../components/Header';
import { Loader } from '../components/Loader';
import { Chip, QuestionRow, focusEl } from '../components/QuestionRow';
import { DIFF, NO_FILTERS, essential, filtering, nextUp, pct, topicStats, visible, type Diff, type Filters, type Question, type Roadmap, type TopicStat } from '../lib';
import { useStore } from '../store';

export const typing = (e: KeyboardEvent) =>
  !!(e.target as HTMLElement).closest?.('input, textarea, select, button, a') || e.metaKey || e.ctrlKey || e.altKey;

// /review (the header bell): show only what's due, on the roadmap you were last on.
export function Review() {
  const { setFilters, lastRoadmap } = useStore();
  useEffect(() => setFilters({ ...NO_FILTERS, status: 'due' }), [setFilters]);
  return <Navigate to={`/roadmap/${lastRoadmap.current}`} replace />;
}

function TopicMap({ rm, stats }: { rm: Roadmap; stats: Record<string, TopicStat> }) {
  const host = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const n = (id: string) => id.replace(/-/g, '_');
    const lines = ['flowchart LR'];
    for (const t of rm.topics) {
      const s = stats[t.id];
      lines.push(`  ${n(t.id)}["${t.title.replace(/"/g, "'")}<br/>${s.done}/${s.total}"]:::${s.met ? 'done' : s.done ? 'wip' : 'todo'}`);
      for (const p of t.prereqs) lines.push(`  ${n(p)} --> ${n(t.id)}`);
    }
    const css = getComputedStyle(document.documentElement), v = (k: string) => css.getPropertyValue(k).trim();
    lines.push(`  classDef done fill:${v('--accent')},stroke:${v('--accent')},color:${v('--on-accent')}`,
      `  classDef wip fill:${v('--accent-soft')},stroke:${v('--accent')},color:${v('--text')}`, '  classDef todo fill:transparent');
    import('mermaid')
      .then(({ default: m }) => { m.initialize({ startOnLoad: false, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' }); return m.render('topic-map-' + Date.now(), lines.join('\n')); })
      .then(({ svg }) => { if (host.current) host.current.innerHTML = svg; })
      .catch(e => { console.warn('topic map', e); if (host.current) host.current.textContent = 'Could not draw the topic map.'; })
      .finally(() => setDrawn(true));
  }, [rm, stats]);
  return <>{!drawn && <Loader label="Drawing the topic map…" />}<div className="map-host" ref={host} hidden={!drawn} /></>;
}

export default function RoadmapPage() {
  const store = useStore();
  const { rmById, roadmaps, progress, filters, setFilters, st, openTopics, setOpenTopic, showStatus, lastRoadmap } = store;
  const rm = rmById[useParams().id!] || roadmaps[0];
  const [mapOpen, setMapOpen] = useState(false);
  const [flash, setFlash] = useState<string>();
  const search = useRef<HTMLInputElement>(null);
  const patterns = useMemo(() => [...new Set(rm.topics.flatMap(t => t.questions.flatMap(q => q.patterns || [])))].sort(), [rm]);
  const stats = useMemo(() => topicStats(rm, progress), [rm, progress]);
  const due = useDueCount();

  useEffect(() => {
    lastRoadmap.current = rm.id;
    if (filters.pattern && !patterns.includes(filters.pattern)) setFilters(f => ({ ...f, pattern: '' }));
  }, [rm]);

  const goNext = () => {
    const q = nextUp(rm, progress, filters);
    if (!q) return showStatus('Nothing left here. Nice!');
    const { t } = store.byId[q.id];
    setOpenTopic(t.id, true);
    if (q.group) setOpenTopic(`${t.id}/${q.group}`, true);
    setFlash(q.id + ':' + Date.now());
  };
  useEffect(() => { if (flash) focusEl(document.querySelector(`.q[data-id="${flash.split(':')[0]}"]`)); }, [flash]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.key === '/') { e.preventDefault(); search.current?.focus(); }
      else if (e.key === 'n') goNext();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const set = (k: keyof Filters) => (e: { target: { value: string } }) => setFilters(f => ({ ...f, [k]: e.target.value }));
  const pool = rm.topics.flatMap(t => t.questions).filter(q => essential(q, filters));
  const solved = pool.filter(q => st(q.id).done);
  const stat = (label: string, n: number, of?: number, cls = '') =>
    <div className={cls} key={label}><dt>{label}</dt><dd>{n}{of !== undefined && <span>/{of}</span>}</dd></div>;
  const mockable = rm.mock;

  const topics = rm.topics.map((t, i) => {
    const qs = t.questions.filter(q => visible(q, st(q.id), filters));
    if (filtering(filters) && !qs.length) return null;
    const s = stats[t.id];
    const unmet = t.prereqs.filter(p => !stats[p].met); // met prerequisites need no reminder
    const groups: [string | undefined, Question[]][] = [];
    for (const q of qs) (groups.at(-1)?.[0] === q.group ? groups.at(-1)! : groups[groups.push([q.group, []]) - 1])[1].push(q);
    const open = openTopics.has(t.id) || !!filters.q || !!filters.pattern || filters.status === 'due';
    return (
      <details key={t.id} className={`topic ${s.done === s.total ? 'complete' : ''}`} id={`t-${t.id}`} open={open}
        onToggle={e => setOpenTopic(t.id, e.currentTarget.open)}>
        <summary>
          <CaretRightIcon className="ph caret" />
          <span className="num">{s.done === s.total ? <CheckIcon /> : i + 1}</span>
          <span className="title">{t.title}</span>
          {unmet.length > 0 && <span className="needs">{unmet.map(p => <Chip key={p} tid={p} stats={stats} />)}</span>}
          <span className="topic-progress"><span className="count">{s.done}/{s.total}</span><span className="bar small"><i style={{ width: pct(s.done, s.total) + '%' }} /></span></span>
          {t.note && <Link className="note-link" to={`/notes/${t.note}`} title="Pattern notes"><BookOpenTextIcon /><span>Notes</span></Link>}
        </summary>
        {open && groups.map(([g, list], gi) => {
          const rows = list.map(q => <QuestionRow key={q.id} q={q} stats={stats} />);
          if (!g || new Set(t.questions.map(q => q.group)).size < 2) return <Fragment key={gi}>{g && <h4>{g}</h4>}{rows}</Fragment>;
          // Sub-sections fold too. They stay open while a filter is on, so matches are never hidden.
          const key = `${t.id}/${g}`, all = t.questions.filter(q => q.group === g), done = all.filter(q => st(q.id).done).length;
          return (
            <details key={gi} className={`group ${done === all.length ? 'complete' : ''}`} open={openTopics.has(key) || filtering(filters)} onToggle={e => setOpenTopic(key, e.currentTarget.open)}>
              <summary><CaretRightIcon className="ph caret" /><span>{g}</span>{done === all.length && <span className="group-done"><CheckIcon weight="bold" />Completed</span>}<span className="count">{done}/{all.length}</span></summary>
              {rows}
            </details>
          );
        })}
      </details>
    );
  }).filter(Boolean);

  return <>
    <section className="head">
      <div className="head-row">
        <h1>{rm.title}</h1>
        <div className="head-actions">
          {mockable && <Link className="btn" to={`/mock/${rm.id}`}><TimerIcon />Mock interview</Link>}
          <button id="next" className="primary" title="Shortcut: n" onClick={goNext}>Next up <ArrowRightIcon /></button>
        </div>
      </div>
      <div className="progress"><div className="bar"><i style={{ width: pct(solved.length, pool.length) + '%' }} /></div><span id="pct">{pct(solved.length, pool.length)}%</span></div>
      <dl className="stats">
        {stat(filters.tier ? 'Essentials solved' : 'Solved', solved.length, pool.length)}
        {(Object.keys(DIFF) as Diff[]).map(d => stat(DIFF[d], solved.filter(q => q.diff === d).length, pool.filter(q => q.diff === d).length, d))}
        {stat('To revise', pool.filter(q => st(q.id).rev).length)}
      </dl>
      {due > 0 && filters.status !== 'due' && <div className="banner"><BellRingingIcon />
        <span><b>{due} question{due > 1 ? 's' : ''} due for review.</b> Re-solve without looking at your old code, then mark Remembered or Forgot.</span>
        <Link to="/review">Review now</Link></div>}
      <div className="filters">
        <label className="search"><MagnifyingGlassIcon />
          <input ref={search} id="f-q" type="search" placeholder="Search questions" aria-label="Search questions" value={filters.q} onChange={set('q')} /><kbd>/</kbd></label>
        <select id="f-tier" aria-label="Tier" value={filters.tier} onChange={set('tier')}>
          <option value="">All questions</option><option value="ess">Essentials only (skip Pro)</option></select>
        {patterns.length > 0 && <select id="f-pattern" aria-label="Pattern" value={filters.pattern} onChange={set('pattern')}>
          <option value="">All patterns</option>{patterns.map(p => <option key={p} value={p}>{p}</option>)}</select>}
        <select id="f-diff" aria-label="Difficulty" value={filters.diff} onChange={set('diff')}>
          <option value="">All levels</option>{(Object.keys(DIFF) as Diff[]).map(k => <option key={k} value={k}>{DIFF[k]}</option>)}</select>
        <select id="f-status" aria-label="Status" value={filters.status} onChange={set('status')}>
          <option value="">Any status</option><option value="todo">To do</option><option value="done">Solved</option>
          <option value="rev">Revise</option><option value="star">Starred</option><option value="due">Due for review</option></select>
      </div>
      <details id="map" onToggle={e => setMapOpen(e.currentTarget.open)}>
        <summary><GraphIcon />Topic map</summary>
        {mapOpen && <TopicMap rm={rm} stats={stats} />}
      </details>
    </section>
    <div id="list">
      {topics.length ? topics : <div className="empty"><FunnelSimpleIcon /><p>No questions match these filters.</p>
        <button onClick={() => setFilters(NO_FILTERS)}>Clear filters</button></div>}
    </div>
  </>;
}

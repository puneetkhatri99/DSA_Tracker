import { FireIcon } from '@phosphor-icons/react';
import { Fragment, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { QuestionRow } from '../components/QuestionRow';
import { DAILY_NEW, activity, addDays, daysUntil, essential, isDue, streakOf, today, topicStats, type Question, type TopicStat } from '../lib';
import { useStore } from '../store';

const WEEKS = 53;
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T00:00').toLocaleDateString('en-US', o);
const solves = (n: number) => `${n} ${n === 1 ? 'solve or review' : 'solves and reviews'}`;

// A year of activity, GitHub style: one column per week (Sunday on top), month names above, hover for the day.
function Calendar({ counts }: { counts: Record<string, number> }) {
  const card = useRef<HTMLDivElement>(null), scroller = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; align: string; text: string } | null>(null);
  useLayoutEffect(() => { scroller.current!.scrollLeft = scroller.current!.scrollWidth; }, []); // phones start at this week

  const days: string[] = [];
  for (let d = addDays(today(), -(WEEKS - 1) * 7 - new Date().getDay()); d <= today(); d = addDays(d, 1)) days.push(d);
  const months = days.flatMap((d, i) => (i === 0 || d.endsWith('-01') ? [{ col: Math.floor(i / 7), label: fmt(d, { month: 'short' }) }] : []));
  if (months.length > 1 && months[1].col - months[0].col < 3) months.shift(); // a partial first month would overlap the next label
  let total = 0, active = 0, run = 0, best = 0;
  for (const d of days) {
    const n = counts[d] || 0;
    total += n;
    active += +!!n;
    run = n ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const show = (e: MouseEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');
    if (!cell) return setTip(null);
    const r = cell.getBoundingClientRect(), box = card.current!.getBoundingClientRect(), n = counts[cell.dataset.date!] || 0;
    const x = r.left + r.width / 2 - box.left;
    setTip({ x, y: r.top - box.top, align: x < 130 ? 'start' : x > box.width - 130 ? 'end' : '', // keep it inside the card near the edges
      text: `${n ? solves(n) : 'Nothing'} on ${fmt(cell.dataset.date!, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` });
  };
  return (
    <div className="cal" ref={card}>
      <div className="cal-head">
        <p><b>{total}</b> {total === 1 ? 'solve or review' : 'solves and reviews'} in the past year</p>
        <p>Active days <b>{active}</b></p>
        <p>Max streak <b>{best}</b></p>
      </div>
      <div className="cal-scroll" ref={scroller}>
        <div className="cal-grid" role="img" aria-label={`${solves(total)} in the past year, on ${active} days`}>
          <div className="cal-months">{months.map(m => <span key={m.col} style={{ gridColumn: `${m.col + 1} / span 3` }}>{m.label}</span>)}</div>
          <div className="cal-days"><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div>
          <div className="cal-cells" onMouseOver={show} onMouseLeave={() => setTip(null)}>
            {days.map(d => { const n = counts[d] || 0; return <i key={d} data-date={d} className={`l${n >= 6 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n ? 1 : 0}`} />; })}
          </div>
        </div>
      </div>
      <div className="cal-foot"><span className="legend">Less <i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" /> More</span></div>
      {tip && <div className={`cal-tip ${tip.align}`} style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  );
}

export default function Today() {
  const { roadmaps, byId, progress, meta, setMeta, st, filters } = useStore();
  const learn = roadmaps[0];
  const flow = learn.topics.filter(t => !t.optional).flatMap(t => t.questions).filter(q => essential(q, filters));
  const solvedToday = flow.filter(q => st(q.id).done === today());
  const left = flow.filter(q => !st(q.id).done);
  const target = meta.target, days = target ? daysUntil(target) + 1 : 0;
  // Pace is worked out from the start of the day, so the list does not grow as you tick things off.
  const perDay = days > 0 ? Math.ceil((left.length + solvedToday.length) / days) : DAILY_NEW;
  const fresh = [...solvedToday, ...left.slice(0, Math.max(0, perDay - solvedToday.length))];
  const due = Object.values(byId).filter(({ q }) => isDue(st(q.id))).map(({ q }) => q);
  const statsOf: Record<string, Record<string, TopicStat>> = {};
  const rows = (list: Question[]) => list.map((q, i) => { // grouped under topic headings, like the roadmap view
    const { rm, t } = byId[q.id];
    const head = i && byId[list[i - 1].id].t === t ? null : <h4>{rm === learn ? '' : rm.title + ': '}{t.title}</h4>;
    return <Fragment key={q.id}>{head}<QuestionRow q={q} stats={(statsOf[rm.id] ||= topicStats(rm, progress))} /></Fragment>;
  });
  const counts = activity(progress, meta);
  const streak = streakOf(counts);
  return <>
    <section className="head">
      <div className="head-row">
        <h1>Today</h1>
        <span className={`streak ${streak ? 'on' : ''}`}><FireIcon />{streak ? `${streak}-day streak` : 'Solve or review something to start a streak'}</span>
      </div>
      <p className="pace"><label>Finish the {learn.title} by <input type="date" id="target" value={target || ''} min={today()} onChange={e => setMeta({ target: e.target.value })} /></label>
        <span>{days > 0 ? `${left.length} left, so ${perDay} new a day.` : target ? 'That date has passed. Pick a new one.' : `No date set, so ${DAILY_NEW} new a day.`}{filters.tier ? ' Essentials only.' : ''}</span></p>
    </section>
    <section className="day">
      <h2>Reviews due <span>{due.length}</span></h2>
      {due.length ? <div className="card">{rows(due)}</div> : <p className="quiet">No reviews due today.</p>}
    </section>
    <section className="day">
      <h2>New today <span>{solvedToday.length}/{fresh.length}</span></h2>
      {fresh.length ? <div className="card">{rows(fresh)}</div> : <p className="quiet">You have solved the whole {learn.title}.</p>}
    </section>
    <section className="day">
      <h2>Activity</h2>
      <Calendar counts={counts} />
    </section>
  </>;
}

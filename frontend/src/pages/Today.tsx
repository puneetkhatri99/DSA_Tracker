import { FireIcon } from '@phosphor-icons/react';
import { Fragment, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { QuestionRow } from '../components/QuestionRow';
import { DAILY_NEW, activity, addDays, daysUntil, essential, isDue, monthsUpTo, streakOf, sumDays, today, topicStats, type DayCount, type Question, type TopicStat } from '../lib';
import { useStore } from '../store';

const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T00:00').toLocaleDateString('en-US', o);
// "3 solved, 2 reviewed", leaving out a zero; '' when both are zero
const said = (c?: DayCount) => [c?.solved && `${c.solved} solved`, c?.reviewed && `${c.reviewed} reviewed`].filter(Boolean).join(', ');
const level = (n: number) => (n >= 6 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n ? 1 : 0);

// A year of activity in month blocks: one column per week of the month (Sunday on top), hover for the day.
// Colour is solves + reviews; the numbers keep them apart.
function Calendar({ counts }: { counts: Record<string, DayCount> }) {
  const card = useRef<HTMLDivElement>(null), scroller = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; align: string; text: string } | null>(null);
  useLayoutEffect(() => { scroller.current!.scrollLeft = scroller.current!.scrollWidth; }, []); // phones start at this month

  const months = monthsUpTo(today());
  const days = months.flatMap(m => m.days);
  const total = sumDays(days.map(d => counts[d]));
  let active = 0, run = 0, best = 0;
  for (const d of days) {
    active += +!!counts[d];
    run = counts[d] ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const show = (e: MouseEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');
    if (!cell) return setTip(null);
    const r = cell.getBoundingClientRect(), box = card.current!.getBoundingClientRect();
    const x = r.left + r.width / 2 - box.left;
    setTip({ x, y: r.top - box.top, align: x < 130 ? 'start' : x > box.width - 130 ? 'end' : '', // keep it inside the card near the edges
      text: `${said(counts[cell.dataset.date!]) || 'Nothing'} on ${fmt(cell.dataset.date!, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}` });
  };
  return (
    <div className="cal" ref={card}>
      <div className="cal-head">
        <p><b>{total.solved}</b> solved · <b>{total.reviewed}</b> reviewed in the past year</p>
        <p>Active days <b>{active}</b></p>
        <p>Max streak <b>{best}</b></p>
      </div>
      <div className="cal-scroll" ref={scroller}>
        <div className="cal-grid" role="img" aria-label={`${total.solved} solved and ${total.reviewed} reviewed in the past year, on ${active} days`}>
          <div className="cal-days"><div><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div><b className="cal-label" /></div>
          <div className="cal-months" onMouseOver={show} onMouseLeave={() => setTip(null)}>
            {months.map(m => {
              const cols = Math.ceil((m.pad + m.days.length) / 7), sum = sumDays(m.days.map(d => counts[d]));
              return (
                // width = cols × day + (cols − 1) × 3px gap, so every month's days come out the same size
                <div key={m.first} className="cal-month" style={{ flex: `${cols} 1 ${(cols - 1) * 3}px` }}>
                  <div className="cal-cells" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                    {Array.from({ length: m.pad }, (_, i) => <i key={i} className="pad" />)}
                    {m.days.map(d => <i key={d} data-date={d} className={`l${level((counts[d]?.solved || 0) + (counts[d]?.reviewed || 0))}`} />)}
                  </div>
                  <b className="cal-label" title={`${fmt(m.first, { month: 'long', year: 'numeric' })}: ${said(sum) || 'nothing yet'}`}>{fmt(m.first, { month: 'short' })}</b>
                </div>
              );
            })}
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
  const target = meta.target, days = target ? daysUntil(target) + 1 : 0;   // today and the finish day both count
  // A finish date of today or earlier leaves nothing to spread out (it used to put every question left on today's list).
  // Pace is worked out from the start of the day, so the list does not grow as you tick things off.
  const perDay = days > 1 ? Math.ceil((left.length + solvedToday.length) / days) : DAILY_NEW;
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
      <p className="pace"><label>Finish the {learn.title} by <input type="date" id="target" value={target || ''} min={addDays(today(), 1)}
        onChange={e => setMeta({ target: e.target.value || undefined })} /></label>{/* cleared → no date; the API rejects '' */}
        <span>{days > 1 ? `${left.length} left, so ${perDay} new a day.`
          : target ? `${days === 1 ? 'That is today' : 'That date has passed'}. Pick a later date; until then ${DAILY_NEW} new a day.`
          : `No date set, so ${DAILY_NEW} new a day.`}{filters.tier ? ' Essentials only.' : ''}</span></p>
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

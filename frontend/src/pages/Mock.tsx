import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, CheckIcon, LightbulbIcon, ShuffleIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Clock } from '../components/Header';
import { Links } from '../components/QuestionRow';
import { DIFF, MOCK_MINUTES, type Question } from '../lib';
import { useStore } from '../store';

// A random unsolved question against the clock, with the topic hidden until you ask for it.
export default function Mock() {
  const { rmById, roadmaps, byId, st, solve, startTimer, timer } = useStore();
  const rm = rmById[useParams().id!] || roadmaps.find(r => r.mock) || roadmaps[0];
  const [mock, setMock] = useState<{ q?: Question; hint: boolean; result: string }>({ hint: false, result: '' });

  const pick = (prev?: Question) => {
    const pool = rm.topics.flatMap(t => t.questions).filter(q => !st(q.id).done && q.id !== prev?.id);
    const q = pool[Math.floor(Math.random() * pool.length)] || (prev && !st(prev.id).done ? prev : undefined);
    if (q) startTimer(q.id, MOCK_MINUTES);
    setMock({ q, hint: false, result: '' });
  };
  useEffect(() => { pick(); }, [rm.id]);

  const finish = (how: 'alone' | 'hint') => {
    const q = mock.q!;
    const over = timer?.id === q.id && Date.now() - timer.start > MOCK_MINUTES * 6e4;
    const mins = timer?.id === q.id ? Math.max(1, Math.round((Date.now() - timer.start) / 6e4)) : st(q.id).mins;
    solve(q.id, how === 'alone' && !mock.hint ? 'alone' : 'hint');
    setMock(m => ({ ...m, result: `Solved in ${mins} min${over ? `, over the ${MOCK_MINUTES}-minute limit` : ''}.` }));
  };
  const { q } = mock;
  return <>
    <section className="head">
      <div className="head-row"><h1>Mock interview</h1><Link className="btn" to={`/roadmap/${rm.id}`}><ArrowLeftIcon />{rm.nav || rm.title}</Link></div>
      <p className="lede">One unsolved question, {MOCK_MINUTES} minutes. Say your approach out loud before you code.</p>
    </section>
    {!q ? <div className="empty"><CheckCircleIcon /><p>Every question in {rm.title} is solved.</p></div> :
      <div className="stage">
        <div className="meta"><span className={`diff ${q.diff}`}>{DIFF[q.diff]}</span>{mock.hint && <span className="tag">{q.group || byId[q.id].t.title}</span>}</div>
        <a className="stage-title" href={st(q.id).lc || q.url} target="_blank" rel="noopener">{q.title}</a>
        <Links q={q} />
        <div className="stage-clock">{timer?.id === q.id && <Clock />}</div>
        {mock.result ? <>
          <p className="stage-result">{mock.result}</p>
          <div className="stage-actions"><button className="primary" onClick={() => pick(q)}>Next question <ArrowRightIcon /></button></div>
        </> : <>
          <div className="stage-actions">
            <button className="btn" disabled={mock.hint} onClick={() => setMock(m => ({ ...m, hint: true }))}><LightbulbIcon />Show topic</button>
            <button className="btn" onClick={() => finish('hint')}>Solved with a hint</button>
            <button className="primary" onClick={() => finish('alone')}><CheckIcon />Solved it</button>
          </div>
          <button className="text-btn" onClick={() => pick(q)}><ShuffleIcon />Skip, give me another</button>
        </>}
      </div>}
  </>;
}

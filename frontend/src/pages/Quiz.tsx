import { ArrowCounterClockwiseIcon, ArrowLeftIcon, ArrowRightIcon, BookOpenTextIcon, CheckCircleIcon, CheckIcon, EyeIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Loader } from '../components/Loader';
import { Markdown, inlineMd } from '../components/Markdown';
import { javaHtml } from '../highlight';
import { LEVELS, LEVEL_NAME, PASS, passed, shuffle, standing, withBest, type Level, type QuizBank, type QuizQuestion, type Topic } from '../lib';
import { useStore } from '../store';

// One file per Learn topic (src/quiz/<topic id>.json), loaded only when you open that topic's quiz.
const banks = Object.fromEntries(Object.entries(import.meta.glob<QuizBank>('../quiz/*.json', { import: 'default' }))
  .map(([path, load]) => [path.slice(path.lastIndexOf('/') + 1, -5), load]));
const PER_LEVEL = 5;
const LETTERS = 'ABCD';

// picks[j]: the option (its index in the file) chosen for question j; -1 = showed the answer; null = not answered yet.
interface Attempt { order: number[][]; picks: (number | null)[]; i: number }
const start = (qs: QuizQuestion[]): Attempt => ({ order: qs.map(q => shuffle(q.options.map((_, k) => k))), picks: qs.map(() => null), i: 0 });

export default function QuizPage() {
  const { roadmaps } = useStore();
  const { topic, level } = useParams();
  if (!topic) return <Overview />;
  const t = roadmaps[0].topics.find(x => x.id === topic && banks[x.id]);
  if (!t || !LEVELS.includes(level as Level)) return <Navigate to="/quiz" replace />;
  return <Run key={`${t.id}/${level}`} topic={t} level={level as Level} />;
}

// Every topic with its level and the best score at each difficulty.
function Overview() {
  const { roadmaps, meta } = useStore();
  const topics = roadmaps[0].topics.filter(t => banks[t.id]);
  const quiz = meta.quiz || {};
  return <>
    <section className="head">
      <h1>Quiz</h1>
      <p className="lede">Each topic has 5 easy, 5 medium and 5 hard questions, each with a full explanation.
        Get {Math.ceil(PASS * PER_LEVEL)} of {PER_LEVEL} right to pass a level. Your level in a topic is the hardest one you have passed.</p>
      <dl className="stats">{LEVELS.map(l =>
        <div key={l} className={l[0].toUpperCase()}><dt>{LEVEL_NAME[l]} passed</dt>
          <dd>{topics.filter(t => passed(quiz[t.id]?.[l], PER_LEVEL)).length}<span>/{topics.length}</span></dd></div>)}</dl>
    </section>
    <div className="quiz-topics">
      {topics.map((t, i) => {
        const s = quiz[t.id] || {}, at = standing(s, PER_LEVEL);
        return (
          <div key={t.id} className="quiz-topic">
            <span className="num">{i + 1}</span>
            <span className="title">{t.title}</span>
            <span className={`standing ${at ? 'on' : ''}`}>{at ? `Level: ${LEVEL_NAME[at]}` : Object.keys(s).length ? 'No level passed yet' : 'Not taken yet'}</span>
            <span className="levels">{LEVELS.map(l =>
              <Link key={l} className={`lvl ${l} ${passed(s[l], PER_LEVEL) ? 'pass' : ''}`} to={`/quiz/${t.id}/${l}`}
                title={s[l] === undefined ? `Start ${LEVEL_NAME[l].toLowerCase()}` : `Best: ${s[l]} of ${PER_LEVEL}`}>
                {passed(s[l], PER_LEVEL) && <CheckIcon />}{LEVEL_NAME[l]}<b>{s[l] ?? '–'}/{PER_LEVEL}</b></Link>)}</span>
          </div>
        );
      })}
    </div>
  </>;
}

function Run({ topic, level }: { topic: Topic; level: Level }) {
  const { meta, setMeta } = useStore();
  const navigate = useNavigate();
  const [qs, setQs] = useState<QuizQuestion[]>();
  const [run, setRun] = useState<Attempt>();
  const [error, setError] = useState('');
  useEffect(() => {
    banks[topic.id]().then(b => { setQs(b[level]); setRun(start(b[level])); }, e => setError(e.message));
  }, []);

  const finished = !!qs && !!run && run.i >= qs.length;
  const pick = run && !finished ? run.picks[run.i] : null;
  const choose = (k: number) => {
    if (run && !finished && pick === null) setRun({ ...run, picks: run.picks.map((p, j) => (j === run.i ? k : p)) });
  };
  const next = () => {
    if (!qs || !run || pick === null) return;
    if (run.i + 1 === qs.length) setMeta({ quiz: withBest(meta.quiz, topic.id, level, qs.filter((q, j) => run.picks[j] === q.answer).length) });
    setRun({ ...run, i: run.i + 1 });
  };
  useEffect(() => { // 1–4 picks an option, Enter goes on
    const onKey = (e: KeyboardEvent) => {
      if (!run || finished || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest?.('input, textarea, select')) return;
      const n = '1234'.indexOf(e.key);
      if (n >= 0 && pick === null) choose(run.order[run.i][n]);
      // An enabled button or link handles Enter itself; a clicked option is disabled by now and must not swallow it.
      else if (e.key === 'Enter' && pick !== null && !(e.target as HTMLElement).closest?.('a, button:not(:disabled)')) { e.preventDefault(); next(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const best = meta.quiz?.[topic.id] || {};
  const head = (
    <section className="head">
      <div className="head-row"><h1>{topic.title}</h1><Link className="btn" to="/quiz"><ArrowLeftIcon />All topics</Link></div>
      <nav className="level-tabs" aria-label="Level">{LEVELS.map(l =>
        <Link key={l} to={`/quiz/${topic.id}/${l}`} className={`${l} ${l === level ? 'active' : ''}`} aria-current={l === level ? 'page' : undefined}>
          {LEVEL_NAME[l]}<small>{best[l] === undefined ? 'not taken' : `best ${best[l]}/${PER_LEVEL}`}</small></Link>)}</nav>
    </section>
  );
  if (error) return <>{head}<p className="bad">Could not load the quiz: {error}</p></>;
  if (!qs || !run) return <>{head}<Loader label="Loading questions…" /></>;

  if (finished) {
    const right = qs.filter((q, j) => run.picks[j] === q.answer).length, ok = passed(right, qs.length);
    const up = LEVELS[LEVELS.indexOf(level) + 1];
    return <>
      {head}
      <div className="stage quiz-result">
        <p className={`score ${ok ? 'pass' : ''}`}>{ok ? <CheckCircleIcon /> : <XIcon />}<b>{right} of {qs.length}</b>{ok ? `${LEVEL_NAME[level]} passed` : 'Not passed yet'}</p>
        <p className="quiet">{ok ? (up ? `Your level in ${topic.title} is at least ${LEVEL_NAME[level]}. Try ${LEVEL_NAME[up]} next.` : `You have passed the hardest level in ${topic.title}.`)
          : `You need ${Math.ceil(PASS * qs.length)} right to pass. Read the explanations below, then try again.`}</p>
        <div className="stage-actions">
          {ok && up && <button className="primary" onClick={() => navigate(`/quiz/${topic.id}/${up}`)}>Start {LEVEL_NAME[up]} <ArrowRightIcon /></button>}
          <button className={ok && up ? 'btn' : 'primary'} onClick={() => setRun(start(qs))}><ArrowCounterClockwiseIcon />Try again</button>
          {topic.note && <Link className="btn" to={`/notes/${topic.note}`}><BookOpenTextIcon />Read the notes</Link>}
        </div>
      </div>
      <h2 className="review-title">Your answers</h2>
      {qs.map((q, j) => (
        <details key={j} className={`stage quiz-review ${run.picks[j] === q.answer ? 'right' : 'wrong'}`} open={run.picks[j] !== q.answer}>
          <summary>{run.picks[j] === q.answer ? <CheckIcon /> : <XIcon />}<span>Question {j + 1}</span>
            <span className="quiz-q-short" dangerouslySetInnerHTML={{ __html: inlineMd(q.q) }} /></summary>
          <Question q={q} order={run.order[j]} pick={run.picks[j]} />
        </details>
      ))}
    </>;
  }

  const q = qs[run.i];
  return <>
    {head}
    <div className="stage quiz-stage">
      <div className="stage-meta"><span>Question {run.i + 1} of {qs.length}</span>
        <span className="dots" aria-hidden="true">{qs.map((x, j) =>
          <i key={j} className={j === run.i ? 'now' : run.picks[j] === null ? '' : run.picks[j] === x.answer ? 'right' : 'wrong'} />)}</span></div>
      <Question q={q} order={run.order[run.i]} pick={pick} onPick={choose} />
      <div className="stage-actions">
        {/* keys: two separate buttons, so focus on one never carries over to the other (Enter twice would reveal the next answer) */}
        {pick === null
          ? <button key="reveal" className="text-btn" onClick={() => choose(-1)}><EyeIcon />I don't know, show the answer</button>
          : <button key="next" className="primary" onClick={next}>{run.i + 1 === qs.length ? 'See my result' : 'Next question'} <ArrowRightIcon /><kbd>Enter</kbd></button>}
      </div>
    </div>
  </>;
}

// A question, its options (in this attempt's shuffled order) and, once answered, what was right and why.
function Question({ q, order, pick, onPick }: { q: QuizQuestion; order: number[]; pick: number | null; onPick?: (k: number) => void }) {
  const answered = pick !== null, letter = LETTERS[order.indexOf(q.answer)];
  return <>
    <p className="quiz-q" dangerouslySetInnerHTML={{ __html: inlineMd(q.q) }} />
    {q.code && <pre className="quiz-code"><code className="language-java hljs" dangerouslySetInnerHTML={{ __html: javaHtml(q.code) }} /></pre>}
    <div className="options">
      {order.map((k, pos) => {
        const state = !answered ? '' : k === q.answer ? 'right' : k === pick ? 'wrong' : 'dim';
        return (
          <button key={k} className={`option ${state}`} disabled={answered} onClick={() => onPick?.(k)}>
            <span className="letter">{LETTERS[pos]}</span>
            <span className="text" dangerouslySetInnerHTML={{ __html: inlineMd(q.options[k]) }} />
            {state === 'right' && <><CheckIcon /><span className="sr-only">(correct answer)</span></>}
            {state === 'wrong' && <><XIcon /><span className="sr-only">(your answer, wrong)</span></>}
          </button>
        );
      })}
    </div>
    {answered && <div className={`explain ${pick === q.answer ? 'right' : 'wrong'}`}>
      <b>{pick === q.answer ? 'Correct.' : pick === -1 ? `The answer is ${letter}.` : `Not quite. The answer is ${letter}.`}</b>
      <Markdown body={q.why} />
    </div>}
  </>;
}

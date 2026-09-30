import { CheckCircleIcon, CheckIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getNote } from '../api';
import { inlineMd } from '../components/Markdown';
import { cardsFrom, shuffle, type Card } from '../lib';
import { useStore } from '../store';
import { typing } from './Roadmap';

interface Quiz { cards: Card[]; topic: string; deck: Card[]; i: number; shown: boolean; right: number; missed: number }
let saved: Quiz | undefined; // the deck survives moving to another page and back

const deal = (q: Omit<Quiz, 'deck' | 'i' | 'shown' | 'right' | 'missed'>): Quiz =>
  ({ ...q, deck: shuffle(q.cards.filter(c => !q.topic || c.note.title === q.topic)), i: 0, shown: false, right: 0, missed: 0 });

// Read the "When to use" signal from a pattern note, name the technique, then check.
export default function QuizPage() {
  const { notes } = useStore();
  const [quiz, setQuizState] = useState(saved);
  const setQuiz = (q: Quiz) => setQuizState((saved = q));
  useEffect(() => {
    if (!saved) Promise.all(notes.map(n => getNote(n.id))).then(all => setQuiz(deal({ cards: all.flatMap(n => cardsFrom(n, n.body)), topic: '' })));
  }, [notes]);
  const act = (a: 'reveal' | 'knew' | 'missed' | 'restart') => {
    if (!quiz) return;
    if (a === 'restart') return setQuiz(deal(quiz));
    if (a === 'reveal') return setQuiz({ ...quiz, shown: true });
    const deck = a === 'missed' ? [...quiz.deck, quiz.deck[quiz.i]] : quiz.deck; // a missed card comes back later
    setQuiz({ ...quiz, deck, i: quiz.i + 1, shown: false, right: quiz.right + +(a === 'knew'), missed: quiz.missed + +(a === 'missed') });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !typing(e) && quiz?.deck[quiz.i] && !quiz.shown) { e.preventDefault(); act('reveal'); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  if (!quiz) return <p className="quiet">Loading cards…</p>;
  const c = quiz.deck[quiz.i];
  const topics = [...new Set(quiz.cards.map(c => c.note.title))];
  return <>
    <section className="head">
      <div className="head-row"><h1>Pattern quiz</h1>
        <select id="quiz-topic" className="select" aria-label="Topic" value={quiz.topic} onChange={e => setQuiz(deal({ cards: quiz.cards, topic: e.target.value }))}>
          <option value="">All topics</option>{topics.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
      <p className="lede">Read the signal, name the technique, then check. Missed cards come back later in the deck.</p>
    </section>
    {c ? <div className="stage">
      <div className="stage-meta"><span>Card {quiz.i + 1} of {quiz.deck.length}</span><span>{quiz.right} knew, {quiz.missed} missed</span></div>
      <p className="signal" dangerouslySetInnerHTML={{ __html: inlineMd(c.signal) }} />
      {quiz.shown ? <>
        <div className="answer"><b>{c.note.title}</b><p dangerouslySetInnerHTML={{ __html: inlineMd(c.full) }} /><Link to={`/notes/${c.note.id}`}>Open the notes</Link></div>
        <div className="stage-actions">
          <button className="btn" data-quiz="missed" onClick={() => act('missed')}><XIcon />Missed it</button>
          <button className="primary" data-quiz="knew" onClick={() => act('knew')}><CheckIcon />Knew it</button>
        </div>
      </> : <div className="stage-actions"><button className="primary" data-quiz="reveal" onClick={() => act('reveal')}>Show answer <kbd>Space</kbd></button></div>}
    </div> : <div className="empty"><CheckCircleIcon /><p>Deck done: {quiz.right} knew, {quiz.missed} missed.</p>
      <button onClick={() => act('restart')}>Shuffle again</button></div>}
  </>;
}

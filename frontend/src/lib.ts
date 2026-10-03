// Types shared with the API, the app's rules, and pure helpers (no React here).
export type Diff = 'E' | 'M' | 'H';
export type How = 'alone' | 'hint' | 'solution';
export interface Question {
  id: string; title: string; diff: Diff; url: string; needs: string[];
  tier?: 'basic' | 'core' | 'pro'; group?: string; patterns?: string[]; alt?: Record<string, string>;
  video?: string; article?: string; premium?: boolean;
}
export interface Topic { id: string; title: string; prereqs: string[]; note?: string; optional?: boolean; questions: Question[] }
export interface Roadmap { id: string; title: string; nav?: string; mock?: boolean; topics: Topic[] }
export interface NoteRef { id: string; title: string; section: string }
export interface Note extends NoteRef { body: string }
export interface QState {
  done?: string; how?: How; mins?: number; lvl?: number; due?: string;
  rev?: boolean; star?: boolean; note?: string; code?: string; lc?: string;
}
export type Level = 'easy' | 'medium' | 'hard';
export type Scores = Partial<Record<Level, number>>;   // best number right, per level
export interface Meta { target?: string; reviews?: Record<string, number>; quiz?: Record<string, Scores> }
export interface QuizQuestion { q: string; code?: string; options: string[]; answer: number; why: string }
export type QuizBank = Record<Level, QuizQuestion[]>;
export interface User { id: string; name: string; email: string; is_admin: boolean }
export interface Filters { tier: string; pattern: string; diff: string; status: string; q: string }
export type Progress = Record<string, QState>;

// Fraction of a topic's questions you must solve before it counts as "done" for prerequisites.
export const PREREQ_DONE = 0.7;
// Spaced repetition: days until the next review, one step per "Remembered". "Forgot" starts again at step 0.
// Solving alone starts at step 1 (3 days); needing a hint or the solution starts at step 0 (tomorrow).
// Past the last step the question counts as mastered.
export const REVIEW_DAYS = [1, 3, 7, 15, 30, 60];
export const HOW: Record<How, string> = { alone: 'Solved alone', hint: 'Needed a hint', solution: 'Saw the solution' };
export const DAILY_NEW = 3;     // new questions a day on Today until you set a finish date
export const MOCK_MINUTES = 45;
export const DIFF: Record<Diff, string> = { E: 'Easy', M: 'Medium', H: 'Hard' };
export const NO_FILTERS: Filters = { tier: '', pattern: '', diff: '', status: '', q: '' };

export const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
export const today = () => new Date().toLocaleDateString('en-CA');
export const addDays = (date: string, n: number) => { const d = new Date(date + 'T00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
export const daysUntil = (date: string) => Math.round((+new Date(date + 'T00:00') - +new Date(today() + 'T00:00')) / 864e5);
export const isDue = (s: QState) => !!s.due && s.due <= today();
export const schedule = (lvl: number) => ({ lvl, due: lvl < REVIEW_DAYS.length ? addDays(today(), REVIEW_DAYS[lvl]) : '' });
export const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const clock = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const SITES: Record<string, string> = { 'leetcode.com': 'LC', 'geeksforgeeks.org': 'GFG', 'takeuforward.org': 'TUF', 'lintcode.com': 'LintCode' };
export const site = (url: string) => Object.entries(SITES).find(([host]) => url.includes(host))?.[1] || 'Link';
export const hasSheetLC = (q: Question) => [q.url, ...Object.values(q.alt || {})].some(u => u.includes('leetcode.com'));
// Your own LeetCode link: a URL or a bare slug ("two-sum"). '' removes it, null means "not a LeetCode link".
export function lcFromInput(v: string): string | null {
  const s = v.trim(), url = /^[a-z0-9-]+$/i.test(s) ? `https://leetcode.com/problems/${s.toLowerCase()}/` : s;
  return !url || /^https?:\/\/(www\.)?leetcode\.(com|cn)\/\S*$/.test(url) ? url : null;
}

// ---------- roadmap rules ----------
export const essential = (q: Question, f: Filters) => !f.tier || q.tier !== 'pro'; // "Essentials only" hides Striver's Pro tier
export const filtering = (f: Filters) => Object.values(f).some(Boolean);
export function visible(q: Question, s: QState, f: Filters) {
  const text = f.q.trim().toLowerCase();
  return essential(q, f) && (!f.pattern || !!q.patterns?.includes(f.pattern)) && (!f.diff || q.diff === f.diff) &&
    (!f.status || (f.status === 'todo' ? !s.done : f.status === 'due' ? isDue(s) : !!s[f.status as 'done' | 'rev' | 'star'])) &&
    (!text || q.title.toLowerCase().includes(text));
}
export interface TopicStat { done: number; total: number; met: boolean; title: string }
export function topicStats(rm: Roadmap, progress: Progress) {
  const stats: Record<string, TopicStat> = {};
  for (const t of rm.topics) {
    const done = t.questions.filter(q => progress[q.id]?.done).length;
    stats[t.id] = { done, total: t.questions.length, met: done >= PREREQ_DONE * t.questions.length, title: t.title };
  }
  return stats;
}
// First unsolved visible question whose needed topics are done (optional topics skipped).
export function nextUp(rm: Roadmap, progress: Progress, f: Filters) {
  const stats = topicStats(rm, progress);
  const todo = rm.topics.filter(t => !t.optional).flatMap(t => t.questions).filter(q => visible(q, progress[q.id] || {}, f) && !progress[q.id]?.done);
  return todo.find(q => q.needs.every(n => stats[n].met)) || todo[0];
}

// ---------- activity ----------
export interface DayCount { solved: number; reviewed: number }
export function activity(progress: Progress, meta: Meta) { // date → questions first solved and reviews done that day (only active days)
  const days: Record<string, DayCount> = {};
  const on = (d: string) => (days[d] ||= { solved: 0, reviewed: 0 });
  for (const [d, n] of Object.entries(meta.reviews || {})) if (n) on(d).reviewed += n;
  for (const s of Object.values(progress)) if (s.done) on(s.done).solved++;
  return days;
}
export const sumDays = (days: (DayCount | undefined)[]) =>
  days.reduce<DayCount>((t, d) => ({ solved: t.solved + (d?.solved || 0), reviewed: t.reviewed + (d?.reviewed || 0) }), { solved: 0, reviewed: 0 });
export function streakOf(days: Record<string, DayCount>) {
  let n = 0;
  for (let d = days[today()] ? today() : addDays(today(), -1); days[d]; d = addDays(d, -1)) n++;
  return n;
}
// The n months up to `end`, each with its days (the 1st up to the month's end, or `end` in the last month)
// and how many blank cells come before the 1st in a Sunday-first week.
export function monthsUpTo(end: string, n = 12) {
  const months: { first: string; pad: number; days: string[] }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end + 'T00:00');
    d.setDate(1);   // before moving the month, so Mar 31 never rolls into "Feb 31"
    d.setMonth(d.getMonth() - i);
    const first = d.toLocaleDateString('en-CA'), days: string[] = [];
    for (let x = first; x <= end && x.slice(0, 7) === first.slice(0, 7); x = addDays(x, 1)) days.push(x);
    months.push({ first, pad: d.getDay(), days });
  }
  return months;
}

// ---------- quiz: 5 questions per level for each topic (frontend/src/quiz/<topic>.json) ----------
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];
export const LEVEL_NAME: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const PASS = 0.8;   // 4 of 5 right passes a level
export const passed = (right: number | undefined, total: number) => right !== undefined && right >= PASS * total;
// Where you stand in a topic: the highest level you have passed ('' = none yet).
export const standing = (s: Scores = {}, total = 5): Level | '' => [...LEVELS].reverse().find(l => passed(s[l], total)) || '';
// A score only replaces the saved one when it is better.
export const withBest = (quiz: Meta['quiz'] = {}, topic: string, level: Level, right: number) =>
  ({ ...quiz, [topic]: { ...quiz[topic], [level]: Math.max(quiz[topic]?.[level] ?? 0, right) } });

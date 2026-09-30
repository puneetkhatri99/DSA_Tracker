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
export interface Meta { target?: string; reviews?: Record<string, number> }
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
export function activity(progress: Progress, meta: Meta) { // date → solves + reviews that day
  const counts: Record<string, number> = { ...meta.reviews };
  for (const s of Object.values(progress)) if (s.done) counts[s.done] = (counts[s.done] || 0) + 1;
  return counts;
}
export function streakOf(counts: Record<string, number>) {
  let n = 0;
  for (let d = counts[today()] ? today() : addDays(today(), -1); counts[d]; d = addDays(d, -1)) n++;
  return n;
}

// ---------- pattern quiz: the "When to use / signals" bullets of a note ----------
export interface Card { note: NoteRef; full: string; signal: string }
export function cardsFrom(note: NoteRef, md: string): Card[] {
  const block = md.split(/^## /m).find(b => /^When to use/i.test(b)) || '';
  // Hide the answer: words from the topic's name become blanks, and "signal: answer" bullets show only the signal.
  const words = (note.title.toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !['basic', 'basics', 'maths', 'advanced', 'algorithms'].includes(w))
    .map(w => w.replace(/s$/, ''));
  const blank = (s: string) => (words.length ? s.replace(new RegExp(`\\b(${words.join('|')})\\w*`, 'gi'), '____') : s);
  return [...block.matchAll(/^- (.+)$/gm)].map(([, line]) => {
    const cut = line.indexOf(': ');
    const answered = cut > 0 && (line.slice(cut).includes('**') || /"$/.test(line.slice(0, cut).trim()));
    return { note, full: line, signal: blank(answered ? line.slice(0, cut) : line) };
  });
}

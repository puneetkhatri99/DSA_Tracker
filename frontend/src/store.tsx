import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import {
  NO_FILTERS, REVIEW_DAYS, addDays, schedule, today,
  type Filters, type How, type Meta, type NoteRef, type Progress, type QState, type Question, type Roadmap, type Topic, type User,
} from './lib';

export interface Content { roadmaps: Roadmap[]; notes: NoteRef[] }
interface Timer { id: string; start: number; limit?: number }

function useStoreValue(user: User, content: Content, initial: Progress & { $meta?: Meta }, logout: () => void) {
  const { $meta = {}, ...start } = initial;
  for (const s of Object.values(start)) // solved before reviews existed → first review the day after solving
    if (s.done && !s.due && !s.lvl) s.due = addDays(s.done, REVIEW_DAYS[0]);
  const [progress, setProgress] = useState<Progress>(start);
  const [meta, setMetaState] = useState<Meta>($meta);
  const [notes, setNotes] = useState(content.notes);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [status, setStatus] = useState({ text: '', bad: false });
  const [asking, setAsking] = useState<Set<string>>(new Set());     // rows showing "How did it go?"
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set()); // rows with the notes panel open
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());
  const lastRoadmap = useRef(content.roadmaps[0].id);

  const { rmById, byId } = useMemo(() => {
    const rmById: Record<string, Roadmap> = {}, byId: Record<string, { q: Question; rm: Roadmap; t: Topic }> = {};
    for (const rm of content.roadmaps) {
      rmById[rm.id] = rm;
      for (const t of rm.topics) for (const q of t.questions) byId[q.id] = { q, rm, t };
    }
    return { rmById, byId };
  }, [content]);

  // ---------- saving: each question is its own small PUT, debounced; flushed when the tab closes ----------
  const ref = useRef({ progress, meta, timer });
  ref.current.timer = timer;
  const pending = useRef(new Map<string, number>());
  const showStatus = useCallback((text: string, bad = false) => setStatus({ text, bad }), []);
  const flush = useCallback((id: string, keepalive = false) => {
    const body = id === '$meta' ? ref.current.meta : ref.current.progress[id] || {};
    api(`/progress/${encodeURIComponent(id)}`, { method: 'PUT', body, keepalive })
      .then(() => { if (!pending.current.size) showStatus('Saved'); })
      .catch(e => showStatus(e.status === 401 ? 'Logged out' : 'Not saved! Check your connection and try again.', true));
  }, [showStatus]);
  const queue = useCallback((id: string) => {
    clearTimeout(pending.current.get(id));
    showStatus('Saving…');
    pending.current.set(id, window.setTimeout(() => { pending.current.delete(id); flush(id); }, 400));
  }, [flush, showStatus]);
  useEffect(() => {
    const now = () => { for (const [id, t] of pending.current) { clearTimeout(t); flush(id, true); } pending.current.clear(); };
    addEventListener('pagehide', now);
    return () => removeEventListener('pagehide', now);
  }, [flush]);

  const setQ = useCallback((id: string, patch: Partial<Record<keyof QState, unknown>>) => {
    const s: Record<string, unknown> = { ...ref.current.progress[id], ...patch };
    for (const k in s) if (!s[k]) delete s[k];   // falsy = not set
    const next = { ...ref.current.progress };
    if (Object.keys(s).length) next[id] = s as QState;
    else delete next[id];
    ref.current.progress = next;
    setProgress(next);
    queue(id);
  }, [queue]);
  const setMeta = useCallback((patch: Meta) => {
    ref.current.meta = { ...ref.current.meta, ...patch };
    setMetaState(ref.current.meta);
    queue('$meta');
  }, [queue]);

  // ---------- timer (one question at a time; mock interviews count down) ----------
  const startTimer = useCallback((id: string, limit?: number) => {
    ref.current.timer = { id, start: Date.now(), limit };
    setTimer(ref.current.timer);
  }, []);
  const stopTimer = useCallback(() => {
    const t = ref.current.timer;
    ref.current.timer = null;
    setTimer(null);
    return t ? Math.max(1, Math.round((Date.now() - t.start) / 6e4)) : 0;
  }, []);

  // First solve: how it went decides the first review. A running timer on this question records the minutes.
  const solve = useCallback((id: string, how: How) => {
    const s = ref.current.progress[id] || {};
    const mins = ref.current.timer?.id === id ? stopTimer() : s.mins;
    setQ(id, { done: s.done || today(), how, mins, ...schedule(how === 'alone' ? 1 : 0), ...(how === 'solution' && { rev: true }) });
  }, [setQ, stopTimer]);
  const review = useCallback((id: string, remembered: boolean) => {
    const s = ref.current.progress[id] || {};
    const mins = ref.current.timer?.id === id ? stopTimer() : s.mins;
    setQ(id, { ...schedule(remembered ? (s.lvl || 0) + 1 : 0), mins });
    const reviews = { ...ref.current.meta.reviews };
    reviews[today()] = (reviews[today()] || 0) + 1;
    setMeta({ reviews });
  }, [setQ, setMeta, stopTimer]);

  const toggle = (set: (f: (s: Set<string>) => Set<string>) => void) => (id: string, on: boolean) =>
    set(s => { if (s.has(id) === on) return s; const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });

  return {
    user, logout, roadmaps: content.roadmaps, rmById, byId, notes, setNotes,
    progress, meta, st: (id: string): QState => progress[id] || {}, setQ, setMeta, solve, review,
    status, showStatus, filters, setFilters, timer, startTimer, stopTimer,
    asking, setAsking: useCallback(toggle(setAsking), []), openNotes, setOpenNote: useCallback(toggle(setOpenNotes), []),
    openTopics, setOpenTopic: useCallback(toggle(setOpenTopics), []), lastRoadmap,
  };
}

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

export function StoreProvider({ user, content, progress, logout, children }:
  { user: User; content: Content; progress: Progress; logout: () => void; children: ReactNode }) {
  return <Ctx.Provider value={useStoreValue(user, content, progress, logout)}>{children}</Ctx.Provider>;
}

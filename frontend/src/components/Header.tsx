import { BellIcon, SignOutIcon, StopIcon, TimerIcon, TreeStructureIcon, UserCircleIcon, UserPlusIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { clock, isDue } from '../lib';
import { useStore } from '../store';

// Ticks once a second while a timer runs. Mock interviews count down from their limit.
export function Clock({ className = '' }: { className?: string }) {
  const { timer } = useStore();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!timer) return;
    const i = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(i);
  }, [timer]);
  if (!timer) return null;
  const spent = Date.now() - timer.start, left = (timer.limit || 0) * 6e4 - spent;
  const over = !!timer.limit && left <= 0;
  return <b className={`${className} ${over ? 'over' : ''}`} data-clock>{over ? "Time's up" : clock(timer.limit ? left : spent)}</b>;
}

export function useDueCount() {
  const { progress, byId } = useStore();
  return Object.entries(progress).filter(([id, s]) => byId[id] && isDue(s)).length;
}

// Who is logged in, the admin's invite page, and log out.
function AccountMenu() {
  const { user, logout } = useStore();
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => { if (menu.current) menu.current.open = false; };
  useEffect(() => {
    const outside = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) close(); };
    addEventListener('click', outside);
    return () => removeEventListener('click', outside);
  }, []);
  return (
    <details className="account" ref={menu}>
      <summary className="icon" title={user.name} aria-label="Account"><UserCircleIcon /></summary>
      <div className="menu">
        <p><b>{user.name}</b><span>{user.email}</span></p>
        {user.is_admin && <Link to="/admin" onClick={close}><UserPlusIcon />Invite people</Link>}
        <button onClick={() => { close(); logout(); }}><SignOutIcon />Log out</button>
      </div>
    </details>
  );
}

export function Header() {
  const { roadmaps, timer, stopTimer, byId, status } = useStore();
  const { pathname } = useLocation();
  const due = useDueCount();
  useEffect(() => { document.title = due ? `(${due}) DSA Tracker` : 'DSA Tracker'; }, [due]);
  const [, view, id] = pathname.split('/');
  const active = (href: string) => {
    if (view === 'mock') return href === `/roadmap/${id}`;
    return href === (['roadmap', 'notes', 'quiz', 'admin'].includes(view) ? `/${view}${view === 'roadmap' ? `/${id}` : ''}` : '/today');
  };
  const nav = [['/today', 'Today'], ...roadmaps.map(r => [`/roadmap/${r.id}`, r.nav || r.title]), ['/quiz', 'Quiz'], ['/notes', 'Notes']];
  return (
    <header>
      <Link className="brand" to="/"><TreeStructureIcon />DSA Tracker</Link>
      <nav id="nav">{nav.map(([href, label]) => <Link key={href} to={href} className={active(href) ? 'active' : ''}>{label}</Link>)}</nav>
      {timer && <span id="timer">
        <TimerIcon /><span className="t-title">{byId[timer.id]?.q.title}</span><Clock />
        <button className="icon" title="Stop timer" aria-label="Stop timer" onClick={stopTimer}><StopIcon /></button>
      </span>}
      {due > 0 && <Link id="due-badge" to="/review" title="Questions due for review"><BellIcon />{due} due</Link>}
      <span id="save-status" className={status.bad ? 'bad' : ''}>{status.text}</span>
      <AccountMenu />
    </header>
  );
}

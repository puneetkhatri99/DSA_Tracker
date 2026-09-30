import { TreeStructureIcon } from '@phosphor-icons/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api';
import type { User } from '../lib';

function AuthCard({ title, lede, error, busy, submit, onSubmit, children }:
  { title: string; lede: string; error: string; busy: boolean; submit: string; onSubmit: (e: FormEvent) => void; children: ReactNode }) {
  return (
    <main className="auth">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="brand"><TreeStructureIcon />DSA Tracker</p>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        {children}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'One moment…' : submit}</button>
      </form>
    </main>
  );
}

const field = (label: string, input: ReactNode) => <label className="field"><span>{label}</span>{input}</label>;

function useSubmit(onDone: (u: User) => void) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const run = (path: string, body: object) => async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { onDone(await api<User>(path, { method: 'POST', body })); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  };
  return { error, busy, run };
}

export function Login({ onDone }: { onDone: (u: User) => void }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const { error, busy, run } = useSubmit(onDone);
  return (
    <AuthCard title="Log in" lede="You stay logged in on this device for 30 days." error={error} busy={busy} submit="Log in"
      onSubmit={run('/auth/login', { email, password })}>
      {field('Email', <input type="email" autoComplete="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} />)}
      {field('Password', <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />)}
    </AuthCard>
  );
}

export function Signup({ onDone }: { onDone: (u: User) => void }) {
  const code = useSearchParams()[0].get('code') || '';
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const { error, busy, run } = useSubmit(onDone);
  if (!code) return <Login onDone={onDone} />;
  return (
    <AuthCard title="Create your account" lede="You were invited to the DSA Tracker. This link works once." error={error} busy={busy} submit="Create account"
      onSubmit={run('/auth/signup', { code, name, email, password })}>
      {field('Name', <input autoComplete="name" required autoFocus maxLength={80} value={name} onChange={e => setName(e.target.value)} />)}
      {field('Email', <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />)}
      {field('Password (8+ characters)', <input type="password" autoComplete="new-password" required minLength={8} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} />)}
    </AuthCard>
  );
}

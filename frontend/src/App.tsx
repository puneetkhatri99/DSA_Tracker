import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { api } from './api';
import { Header } from './components/Header';
import { Loader } from './components/Loader';
import type { Progress, User } from './lib';
import Admin from './pages/Admin';
import { Login, Signup } from './pages/Auth';
import Mock from './pages/Mock';
import RoadmapPage, { Review } from './pages/Roadmap';
import Today from './pages/Today';
import { StoreProvider, useStore, type Content } from './store';

// markdown + sanitizer are only needed here, so these pages load on first visit
const Notes = lazy(() => import('./pages/Notes'));
const Quiz = lazy(() => import('./pages/Quiz'));

function Shell() {
  const { user } = useStore();
  useEffect(() => { // Escape leaves any text box
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && (e.target as HTMLElement).matches?.('input, textarea')) (e.target as HTMLElement).blur(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  return <>
    <Header />
    <main id="main">
      <Suspense fallback={<Loader />}><Routes>
        <Route path="/roadmap/:id" element={<RoadmapPage />} />
        <Route path="/review" element={<Review />} />
        <Route path="/mock/:id" element={<Mock />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/quiz/:topic/:level" element={<Quiz />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes/:id" element={<Notes />} />
        <Route path="/admin" element={user.is_admin ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="/signup" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Today />} />
      </Routes></Suspense>
    </main>
  </>;
}

export default function App() {
  const [user, setUser] = useState<User | null>();   // undefined while checking the session cookie
  const [data, setData] = useState<{ content: Content; progress: Progress }>();
  const [error, setError] = useState('');
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => { api<User>('/auth/me').then(setUser, () => setUser(null)); }, []);
  useEffect(() => {
    const out = () => { setUser(null); setData(undefined); };
    addEventListener('logged-out', out);
    return () => removeEventListener('logged-out', out);
  }, []);
  useEffect(() => {
    if (!user) return;
    Promise.all([api<Content>('/content'), api<Progress>('/progress')])
      .then(([content, progress]) => setData({ content, progress }), e => setError(e.message));
  }, [user]);

  const logout = () => api('/auth/logout', { method: 'POST' }).finally(() => { setUser(null); setData(undefined); navigate('/'); });
  const loggedIn = (u: User) => { setUser(u); if (pathname === '/signup') navigate('/', { replace: true }); };

  if (user === undefined) return <Loader page />;
  if (!user) return pathname === '/signup' ? <Signup onDone={loggedIn} /> : <Login onDone={loggedIn} />;
  if (error) return <main><p className="bad">Failed to load: {error}</p></main>;
  if (!data) return <Loader page label="Loading your roadmaps…" />;
  return <StoreProvider key={user.id} user={user} content={data.content} progress={data.progress} logout={logout}><Shell /></StoreProvider>;
}

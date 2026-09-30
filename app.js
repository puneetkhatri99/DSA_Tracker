// Fraction of a topic's questions you must solve before it counts as "done" for prerequisites.
// 1.0 = every question (strict build-up). Lower it (e.g. 0.8) if you want to move on sooner.
const PREREQ_DONE = 0.7;
// Spaced repetition: days until the next review, one step per "Remembered". "Forgot" starts again at step 0.
// Solving alone starts at step 1 (3 days); needing a hint or the solution starts at step 0 (tomorrow).
// Past the last step the question counts as mastered.
const REVIEW_DAYS = [1, 3, 7, 15, 30, 60];
const HOW = { alone: 'Solved alone', hint: 'Needed a hint', solution: 'Saw the solution' };
const DAILY_NEW = 3;     // new questions a day on Today until you set a finish date
const MOCK_MINUTES = 45;
const DIFF = { E: 'Easy', M: 'Medium', H: 'Hard' };
const META = '$meta';    // progress.json key for settings and the review log (question ids never start with $)

const main = document.getElementById('main');
const roadmaps = {}, byId = {}; // byId: question id → { q, rm, t }
const filters = { tier: '', pattern: '', diff: '', status: '', q: '' };
const openTopics = new Set(), openNotes = new Set(), asking = new Set(), editingCode = new Set();
let content, progress = {}, current, view, timer = null, quiz, mock;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); });
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const st = id => progress[id] || {};
const meta = () => (progress[META] ||= {});
const SITES = { 'leetcode.com': 'LC', 'geeksforgeeks.org': 'GFG', 'takeuforward.org': 'TUF', 'lintcode.com': 'LintCode' };
const site = url => Object.entries(SITES).find(([host]) => url.includes(host))?.[1] || 'Link';
const today = () => new Date().toLocaleDateString('en-CA');
const addDays = (date, n) => { const d = new Date(date + 'T00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const daysUntil = date => Math.round((new Date(date + 'T00:00') - new Date(today() + 'T00:00')) / 864e5);
const isDue = s => !!s.due && s.due <= today();
const schedule = lvl => ({ lvl, due: lvl < REVIEW_DAYS.length ? addDays(today(), REVIEW_DAYS[lvl]) : '' });
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

mermaid.initialize({ startOnLoad: false, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });

async function init() {
  [content, progress] = await Promise.all([getJSON('content.json'), getJSON('/api/progress')]);
  for (const s of Object.values(progress)) // solved before reviews existed → first review the day after solving
    if (s.done && !s.due && !s.lvl) s.due = addDays(s.done, REVIEW_DAYS[0]);
  await Promise.all(content.roadmaps.map(async r => (roadmaps[r.id] = await getJSON(r.file))));
  for (const rm of Object.values(roadmaps)) for (const t of rm.topics) for (const q of t.questions) byId[q.id] = { q, rm, t };
  document.getElementById('nav').innerHTML = '<a href="/today">Today</a>' +
    content.roadmaps.map(r => `<a href="/roadmap/${r.id}">${esc(r.title)}</a>`).join('') + '<a href="/quiz">Quiz</a><a href="/notes">Notes</a>';
  main.addEventListener('click', onClick);
  main.addEventListener('change', onCheck);
  main.addEventListener('input', onType);
  main.addEventListener('focusout', onCodeBlur);
  main.addEventListener('toggle', e => {
    const t = e.target.dataset?.topic;
    if (t) e.target.open ? openTopics.add(t) : openTopics.delete(t);
  }, true);
  document.addEventListener('keydown', onKey);
  document.getElementById('timer').onclick = e => { if (e.target.closest('[data-timer-stop]')) { stopTimer(); refresh(); } };
  setInterval(tick, 1000);
  // Clean URLs: in-app links change the path without a reload; server.js answers every page path with index.html.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="/"]');
    if (!a || a.target || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });
  window.onpopstate = route;
  if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1)); // old #/ bookmarks
  route();
}

function go(path) {
  if (path !== location.pathname) history.pushState(null, '', path);
  route();
}
function route() {
  const [, v, id] = location.pathname.split('/');
  if (v === 'review') { // header bell badge: show only what's due
    Object.assign(filters, { tier: '', pattern: '', diff: '', status: 'due', q: '' });
    history.replaceState(null, '', `/roadmap/${current?.id || content.roadmaps[0].id}`);
    return route();
  }
  view = ['roadmap', 'notes', 'quiz', 'mock'].includes(v) ? v : 'today';
  if (view === 'notes') renderNote(id);
  else if (view === 'quiz') renderQuiz();
  else if (view === 'mock') startMock(roadmaps[id] ? id : content.roadmaps.find(r => r.mock)?.id);
  else if (view === 'roadmap') renderRoadmap(roadmaps[id] ? id : content.roadmaps[0].id);
  else renderToday();
  updateDueBadge();
  const active = view === 'roadmap' ? `/roadmap/${current.id}` : view === 'mock' ? `/roadmap/${mock.rid}` : `/${view}`;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === active));
}
// Re-render whatever view holds question rows after their state changes.
const refresh = () => ({ roadmap: renderList, today: renderToday, mock: renderMock }[view]?.());

// ---------- progress ----------
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  showStatus('Saving…');
  saveTimer = setTimeout(() =>
    fetch('/api/progress', { method: 'PUT', body: JSON.stringify(progress) })
      .then(r => { if (!r.ok) throw new Error(r.status); showStatus('Saved'); })
      .catch(() => showStatus('Not saved! Is `node server.js` running?', true)), 400);
}
function setState(id, patch) {
  const s = { ...st(id), ...patch };
  for (const k in s) if (!s[k]) delete s[k];
  if (Object.keys(s).length) progress[id] = s;
  else delete progress[id];
  save();
}
function showStatus(text, bad) {
  const el = document.getElementById('save-status');
  el.textContent = text;
  el.className = bad ? 'bad' : '';
}
// First solve: how it went decides the first review. A running timer on this question records the minutes.
function solve(id, how) {
  const mins = timer?.id === id ? stopTimer() : st(id).mins;
  setState(id, { done: st(id).done || today(), how, mins, ...schedule(how === 'alone' ? 1 : 0), ...(how === 'solution' && { rev: true }) });
}
function review(id, remembered) {
  const mins = timer?.id === id ? stopTimer() : st(id).mins;
  setState(id, { ...schedule(remembered ? (st(id).lvl || 0) + 1 : 0), mins });
  const log = (meta().reviews ||= {});
  log[today()] = (log[today()] || 0) + 1;
  save();
}

// Header bell badge + tab title: how many solved questions are due for review today.
function updateDueBadge() {
  const n = Object.values(progress).filter(isDue).length;
  const badge = document.getElementById('due-badge');
  badge.hidden = !n;
  badge.innerHTML = `<i class="ph ph-bell" aria-hidden="true"></i>${n} due`;
  document.title = n ? `(${n}) DSA Tracker` : 'DSA Tracker';
  return n;
}

// ---------- timer (one question at a time; mock interviews count down) ----------
function startTimer(id, limit) { timer = { id, start: Date.now(), limit }; tick(); }
function stopTimer() {
  const mins = timer ? Math.max(1, Math.round((Date.now() - timer.start) / 6e4)) : 0;
  timer = null;
  tick();
  return mins;
}
const clock = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function tick() {
  const el = document.getElementById('timer');
  if (!timer) return (el.hidden = true);
  if (el.hidden || el.dataset.id !== timer.id) {
    el.dataset.id = timer.id;
    el.hidden = false;
    el.innerHTML = `<i class="ph ph-timer" aria-hidden="true"></i><span class="t-title">${esc(byId[timer.id].q.title)}</span><b data-clock></b>` +
      '<button class="icon" data-timer-stop title="Stop timer" aria-label="Stop timer"><i class="ph ph-stop" aria-hidden="true"></i></button>';
  }
  const spent = Date.now() - timer.start, left = timer.limit * 6e4 - spent;
  const over = timer.limit && left <= 0;
  document.querySelectorAll('[data-clock]').forEach(c => {
    c.textContent = over ? "Time's up" : clock(timer.limit ? left : spent);
    c.classList.toggle('over', !!over);
  });
}

// ---------- question rows (shared by the roadmap, Today and review lists) ----------
const rowId = el => el.closest('.q').dataset.id;
const filtering = () => Object.values(filters).some(Boolean);
const essential = q => !filters.tier || q.tier !== 'pro'; // "Essentials only" hides Striver's Pro tier
function visible(q) {
  const s = st(q.id);
  return essential(q) && (!filters.pattern || q.patterns?.includes(filters.pattern)) && (!filters.diff || q.diff === filters.diff) &&
    (!filters.status || (filters.status === 'todo' ? !s.done : filters.status === 'due' ? isDue(s) : s[filters.status])) &&
    (!filters.q || q.title.toLowerCase().includes(filters.q));
}
function topicStats(rm = current) {
  const stats = {};
  for (const t of rm.topics) {
    const done = t.questions.filter(q => st(q.id).done).length;
    stats[t.id] = { done, total: t.questions.length, met: done >= PREREQ_DONE * t.questions.length, title: t.title };
  }
  return stats;
}
const chip = (tid, stats) => {
  const s = stats[tid];
  return `<button class="chip ${s.met ? 'met' : ''}" data-goto="${tid}" title="${s.met ? 'Done' : `Builds on this topic (${s.done}/${s.total} solved)`}">` +
    `<i class="ph ${s.met ? 'ph-check' : 'ph-lock-simple'}" aria-hidden="true"></i>${esc(s.title)}</button>`;
};
// Questions the sheet has only on GFG/TUF get an "+ LC" button; the link you add goes first and becomes the title link.
const qUrl = q => st(q.id).lc || q.url;
function links(q) {
  const lc = st(q.id).lc, sheet = [[site(q.url), q.url], ...Object.entries(q.alt || {})];
  const addable = !sheet.some(([, u]) => u.includes('leetcode.com'));
  const label = lc ? 'Edit your LeetCode link' : 'Add a LeetCode link';
  return `<span class="links">${[...(lc ? [['LC', lc]] : []), ...sheet].map(([k, u]) =>
    `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(k)}</a>`).join('')}${addable ? `<button data-lc="${q.id}" title="${label}" aria-label="${label}">` +
    `${lc ? '<i class="ph ph-pencil-simple" aria-hidden="true"></i>' : '+ LC'}</button>` : ''}</span>`;
}
function askLC(id) {
  const v = prompt(`LeetCode link for "${byId[id].q.title}" (a slug like two-sum works too; leave blank to remove)`, st(id).lc || '');
  if (v === null) return;
  const s = v.trim(), url = /^[a-z0-9-]+$/i.test(s) ? `https://leetcode.com/problems/${s.toLowerCase()}/` : s;
  if (url && !/^https?:\/\/(www\.)?leetcode\.(com|cn)\//.test(url)) return showStatus('That is not a leetcode.com link.', true);
  setState(id, { lc: url });
  refresh();
}
const codeView = code => `<pre class="code-view" data-edit-code title="Click to edit"><code class="language-java">${esc(code)}</code></pre>`;
const highlightCode = () => main.querySelectorAll('.code-view code:not([data-highlighted])').forEach(el => hljs.highlightElement(el));

function row(q, stats) {
  const s = st(q.id);
  const locked = q.needs.some(n => !stats[n].met);
  const reviewDue = isDue(s);
  const next = !s.done ? '' : reviewDue ? '' : s.due ? `review in ${daysUntil(s.due)}d` : 'mastered';
  const info = [s.mins && `${s.mins} min`, next].filter(Boolean).join(' · ');
  const timing = timer?.id === q.id;
  return `<div class="q ${s.done ? 'done' : ''} ${reviewDue ? 'due' : ''} ${locked && !s.done ? 'locked' : ''}" data-id="${q.id}">
    <input type="checkbox" ${s.done ? 'checked' : ''} aria-label="Solved">
    <a class="qt" href="${esc(qUrl(q))}" target="_blank" rel="noopener">${esc(q.title)}</a>
    <span class="meta">
      <span class="diff ${q.diff}">${DIFF[q.diff]}</span>
      ${q.tier === 'pro' ? '<span class="tag pro" title="Striver\'s Pro tier: harder or less often asked">Pro</span>' : ''}
      ${q.premium ? '<span class="tag pro" title="LeetCode Premium">Premium</span>' : ''}
      ${links(q)}
      ${q.needs.length ? `<span class="needs">${q.needs.map(n => chip(n, stats)).join('')}</span>` : ''}
    </span>
    <span class="acts">
      ${asking.has(q.id) ? `<span class="how">How did it go? ${Object.entries(HOW).map(([k, v]) =>
        `<button data-how="${k}" class="${s.how === k ? 'on' : ''}">${v}</button>`).join('')}</span>` : ''}
      ${reviewDue ? `<span class="review">Review due <button data-act="recall"><i class="ph ph-check" aria-hidden="true"></i>Remembered</button><button data-act="forgot"><i class="ph ph-x" aria-hidden="true"></i>Forgot</button></span>` : ''}
      ${info ? `<small title="Solved ${s.done}${s.how ? ` (${HOW[s.how].toLowerCase()})` : ''}${s.due ? ', next review ' + s.due : ''}">${info}</small>` : ''}
      <button class="icon ${timing ? 'on' : ''}" data-act="timer" title="${timing ? 'Stop timer' : 'Start timer'}" aria-label="${timing ? 'Stop timer' : 'Start timer'}"><i class="ph ph-timer" aria-hidden="true"></i></button>
      ${q.video ? `<a class="icon" href="${esc(q.video)}" target="_blank" rel="noopener" title="Video solution" aria-label="Video solution"><i class="ph ph-play-circle" aria-hidden="true"></i></a>` : ''}
      ${q.article ? `<a class="icon" href="${esc(q.article)}" target="_blank" rel="noopener" title="Article" aria-label="Article"><i class="ph ph-article" aria-hidden="true"></i></a>` : ''}
      <button class="icon ${s.rev ? 'on' : ''}" data-act="rev" title="Mark to revise" aria-label="Mark to revise" aria-pressed="${!!s.rev}"><i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i></button>
      <button class="icon ${s.star ? 'on' : ''}" data-act="star" title="Star" aria-label="Star" aria-pressed="${!!s.star}"><i class="${s.star ? 'ph-fill' : 'ph'} ph-star" aria-hidden="true"></i></button>
      <button class="icon ${s.note || s.code ? 'on' : ''}" data-act="note" title="My notes and code" aria-label="My notes and code"><i class="ph ph-note-pencil" aria-hidden="true"></i></button>
    </span>
    <div class="panel" ${openNotes.has(q.id) ? '' : 'hidden'}>
      <textarea data-field="note" placeholder="Approach, complexity, gotchas" aria-label="Notes">${esc(s.note || '')}</textarea>
      ${s.code && !editingCode.has(q.id) ? codeView(s.code)
        : `<textarea data-field="code" class="code" spellcheck="false" placeholder="Your Java solution" aria-label="Java solution">${esc(s.code || '')}</textarea>`}
    </div>
  </div>`;
}

function onClick(e) {
  const el = e.target;
  if (el.closest('[data-clear]')) {
    Object.assign(filters, { tier: '', pattern: '', diff: '', status: '', q: '' });
    return renderRoadmap(current.id);
  }
  const goto = el.closest('[data-goto]');
  if (goto) { e.preventDefault(); return focusEl(document.getElementById('t-' + goto.dataset.goto)); }
  if (el.closest('[data-quiz]')) return quizAction(el.closest('[data-quiz]').dataset.quiz);
  if (el.closest('[data-mock]')) return mockAction(el.closest('[data-mock]').dataset.mock);
  if (el.closest('[data-lc]')) return askLC(el.closest('[data-lc]').dataset.lc);
  if (el.closest('[data-edit-code]')) {
    const id = rowId(el);
    editingCode.add(id);
    const ta = document.createElement('div');
    ta.innerHTML = `<textarea data-field="code" class="code" spellcheck="false" aria-label="Java solution">${esc(st(id).code)}</textarea>`;
    el.closest('[data-edit-code]').replaceWith(ta.firstChild);
    return main.querySelector(`[data-id="${id}"] textarea.code`).focus();
  }
  const how = el.closest('[data-how]');
  if (how) { asking.delete(rowId(how)); solve(rowId(how), how.dataset.how); return refresh(); }
  // Opening an unsolved question starts its timer (unless another one is running).
  const open = el.closest('.q a[target=_blank]:not(.icon)');
  if (open && !timer && !st(rowId(open)).done) { startTimer(rowId(open)); return setTimeout(refresh); }
  const btn = el.closest('[data-act]');
  if (!btn) return;
  const id = rowId(btn), act = btn.dataset.act;
  if (act === 'recall' || act === 'forgot') review(id, act === 'recall');
  else if (act === 'timer') timer?.id === id ? stopTimer() : startTimer(id);
  else if (act === 'note') {
    const panel = btn.closest('.q').querySelector('.panel');
    panel.hidden = !panel.hidden;
    return panel.hidden ? openNotes.delete(id) : (openNotes.add(id), highlightCode(), panel.querySelector('textarea').focus());
  } else setState(id, { [act]: !st(id)[act] });
  refresh();
}
function onCheck(e) {
  if (!e.target.matches('.q input[type=checkbox]')) return;
  const id = rowId(e.target);
  if (e.target.checked) { solve(id, 'alone'); asking.add(id); } // "alone" until you say otherwise
  else { asking.delete(id); setState(id, { done: '', lvl: 0, due: '', how: '', mins: 0 }); }
  refresh();
}
function onType(e) {
  const field = e.target.dataset.field;
  if (!field) return;
  const id = rowId(e.target);
  setState(id, { [field]: e.target.value });
  e.target.closest('.q').querySelector('[data-act=note]').classList.toggle('on', !!(st(id).note || st(id).code));
}
// Leaving the code box shows it highlighted again (in place, so a click elsewhere is not lost to a re-render).
function onCodeBlur(e) {
  const ta = e.target;
  if (!ta.matches('textarea.code') || !ta.value.trim()) return;
  editingCode.delete(rowId(ta));
  ta.outerHTML = codeView(ta.value);
  highlightCode();
}
function onKey(e) {
  const t = e.target;
  if (t.matches?.('textarea.code') && e.key === 'Tab' && !e.shiftKey) { // indent instead of leaving the box
    e.preventDefault();
    t.setRangeText('    ', t.selectionStart, t.selectionEnd, 'end');
    return t.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (e.key === 'Escape' && t.matches?.('input, textarea')) return t.blur();
  if (t.closest?.('input, textarea, select, button, a') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/' && document.getElementById('f-q')) { e.preventDefault(); document.getElementById('f-q').focus(); }
  else if (e.key === 'n' && view === 'roadmap') nextUp();
  else if (e.key === ' ' && view === 'quiz' && quiz?.deck[quiz.i] && !quiz.shown) { e.preventDefault(); quizAction('reveal'); }
}

// ---------- roadmap ----------
function renderRoadmap(rid) {
  current = roadmaps[rid];
  const patterns = [...new Set(current.topics.flatMap(t => t.questions.flatMap(q => q.patterns || [])))].sort();
  if (!patterns.includes(filters.pattern)) filters.pattern = '';
  const mockable = content.roadmaps.find(r => r.id === rid).mock;
  main.innerHTML = `
    <section class="head">
      <div class="head-row">
        <h1>${esc(current.title)}</h1>
        <div class="head-actions">
          ${mockable ? `<a class="btn" href="/mock/${rid}"><i class="ph ph-timer" aria-hidden="true"></i>Mock interview</a>` : ''}
          <button id="next" class="primary" title="Shortcut: n">Next up <i class="ph ph-arrow-right" aria-hidden="true"></i></button>
        </div>
      </div>
      <div class="progress"><div class="bar"><i id="overall"></i></div><span id="pct"></span></div>
      <dl id="stats" class="stats"></dl>
      <div id="review-banner" class="banner" hidden></div>
      <div class="filters">
        <label class="search"><i class="ph ph-magnifying-glass" aria-hidden="true"></i><input id="f-q" type="search" placeholder="Search questions" aria-label="Search questions"><kbd>/</kbd></label>
        <select id="f-tier" aria-label="Tier"><option value="">All questions</option><option value="ess">Essentials only (skip Pro)</option></select>
        ${patterns.length ? `<select id="f-pattern" aria-label="Pattern"><option value="">All patterns</option>${patterns.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select>` : ''}
        <select id="f-diff" aria-label="Difficulty"><option value="">All levels</option>${Object.entries(DIFF).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <select id="f-status" aria-label="Status"><option value="">Any status</option><option value="todo">To do</option><option value="done">Solved</option><option value="rev">Revise</option><option value="star">Starred</option><option value="due">Due for review</option></select>
      </div>
      <details id="map"><summary><i class="ph ph-graph" aria-hidden="true"></i>Topic map</summary><div class="map-host"></div></details>
    </section>
    <div id="list"></div>`;
  for (const k of Object.keys(filters)) {
    const el = document.getElementById('f-' + k);
    if (!el) continue;
    el.value = filters[k];
    el.oninput = () => { filters[k] = k === 'q' ? el.value.trim().toLowerCase() : el.value; renderList(); };
  }
  document.getElementById('next').onclick = nextUp;
  document.getElementById('map').ontoggle = e => e.target.open && renderMap();
  renderList();
}

function renderList() {
  const stats = topicStats();
  const pool = current.topics.flatMap(t => t.questions).filter(essential);
  const solved = pool.filter(q => st(q.id).done);
  const stat = (label, n, of, cls = '') => `<div class="${cls}"><dt>${label}</dt><dd>${n}${of === undefined ? '' : `<span>/${of}</span>`}</dd></div>`;
  document.getElementById('overall').style.width = pct(solved.length, pool.length) + '%';
  document.getElementById('pct').textContent = pct(solved.length, pool.length) + '%';
  document.getElementById('stats').innerHTML = stat(filters.tier ? 'Essentials solved' : 'Solved', solved.length, pool.length) +
    Object.keys(DIFF).map(d => stat(DIFF[d], solved.filter(q => q.diff === d).length, pool.filter(q => q.diff === d).length, d)).join('') +
    stat('To revise', pool.filter(q => st(q.id).rev).length);
  const due = updateDueBadge();
  const banner = document.getElementById('review-banner');
  banner.hidden = !due || filters.status === 'due';
  banner.innerHTML = `<i class="ph ph-bell-ringing" aria-hidden="true"></i><span><b>${due} question${due > 1 ? 's' : ''} due for review.</b> ` +
    `Re-solve without looking at your old code, then mark Remembered or Forgot.</span><a href="/review">Review now</a>`;

  document.getElementById('list').innerHTML = current.topics.map((t, i) => {
    const qs = t.questions.filter(visible);
    if (filtering() && !qs.length) return '';
    const s = stats[t.id];
    const unmet = t.prereqs.filter(p => !stats[p].met); // met prerequisites need no reminder
    const groups = [];
    for (const q of qs) (groups.at(-1)?.[0] === q.group ? groups.at(-1)[1] : groups[groups.push([q.group, []]) - 1][1]).push(q);
    return `<details class="topic ${s.done === s.total ? 'complete' : ''}" id="t-${t.id}" data-topic="${t.id}" ${openTopics.has(t.id) || filters.q || filters.pattern || filters.status === 'due' ? 'open' : ''}>
      <summary>
        <i class="ph ph-caret-right caret" aria-hidden="true"></i>
        <span class="num">${s.done === s.total ? '<i class="ph ph-check" aria-hidden="true"></i>' : i + 1}</span>
        <span class="title">${esc(t.title)}</span>
        ${unmet.length ? `<span class="needs">${unmet.map(p => chip(p, stats)).join('')}</span>` : ''}
        <span class="topic-progress"><span class="count">${s.done}/${s.total}</span><span class="bar small"><i style="width:${pct(s.done, s.total)}%"></i></span></span>
        ${t.note ? `<a class="note-link" href="/notes/${current.id}-${t.id}" title="Pattern notes"><i class="ph ph-book-open-text" aria-hidden="true"></i><span>Notes</span></a>` : ''}
      </summary>
      ${groups.map(([g, list]) => `${g ? `<h4>${esc(g)}</h4>` : ''}${list.map(q => row(q, stats)).join('')}`).join('')}
    </details>`;
  }).join('') || `<div class="empty"><i class="ph ph-funnel-simple" aria-hidden="true"></i><p>No questions match these filters.</p>
    <button data-clear>Clear filters</button></div>`;
  highlightCode();
  if (document.getElementById('map').open) renderMap();
}

function focusEl(el) {
  if (!el) return;
  const topic = el.closest('details.topic');
  topic.open = true;
  openTopics.add(topic.dataset.topic);
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1500);
}

// First unsolved visible question whose needed topics are done (optional topics skipped).
function nextUp() {
  const stats = topicStats();
  const todo = current.topics.filter(t => !t.optional).flatMap(t => t.questions).filter(q => visible(q) && !st(q.id).done);
  const q = todo.find(q => q.needs.every(n => stats[n].met)) || todo[0];
  if (!q) return showStatus('Nothing left here. Nice!');
  if (filtering() && !document.querySelector(`[data-id="${q.id}"]`)) renderList();
  focusEl(document.querySelector(`[data-id="${q.id}"]`));
}

function renderMap() {
  const stats = topicStats();
  const n = id => id.replace(/-/g, '_');
  const lines = ['flowchart LR'];
  for (const t of current.topics) {
    const s = stats[t.id];
    lines.push(`  ${n(t.id)}["${t.title.replace(/"/g, "'")}<br/>${s.done}/${s.total}"]:::${s.met ? 'done' : s.done ? 'wip' : 'todo'}`);
    for (const p of t.prereqs) lines.push(`  ${n(p)} --> ${n(t.id)}`);
  }
  const css = getComputedStyle(document.documentElement), v = k => css.getPropertyValue(k).trim();
  lines.push(`  classDef done fill:${v('--accent')},stroke:${v('--accent')},color:${v('--on-accent')}`,
    `  classDef wip fill:${v('--accent-soft')},stroke:${v('--accent')},color:${v('--text')}`, '  classDef todo fill:transparent');
  mermaid.render('topic-map-' + Date.now(), lines.join('\n'))
    .then(({ svg }) => (document.querySelector('.map-host').innerHTML = svg))
    .catch(e => console.warn('topic map', e));
}

// ---------- today: due reviews + today's new questions + pace + activity ----------
function activity() { // date → solves + reviews that day
  const counts = { ...meta().reviews };
  for (const [id, s] of Object.entries(progress)) if (id !== META && s.done) counts[s.done] = (counts[s.done] || 0) + 1;
  return counts;
}
function renderToday() {
  const learn = roadmaps[content.roadmaps[0].id];
  const flow = learn.topics.filter(t => !t.optional).flatMap(t => t.questions).filter(essential);
  const solvedToday = flow.filter(q => st(q.id).done === today());
  const left = flow.filter(q => !st(q.id).done);
  const target = meta().target, days = target ? daysUntil(target) + 1 : 0;
  // Pace is worked out from the start of the day, so the list does not grow as you tick things off.
  const perDay = days > 0 ? Math.ceil((left.length + solvedToday.length) / days) : DAILY_NEW;
  const fresh = [...solvedToday, ...left.slice(0, Math.max(0, perDay - solvedToday.length))];
  const due = Object.values(byId).filter(({ q }) => isDue(st(q.id))).map(({ q }) => q);
  const statsOf = {};
  const rows = list => { // grouped under topic headings, like the roadmap view
    let prev;
    return list.map(q => {
      const { rm, t } = byId[q.id], head = t === prev ? '' : `<h4>${rm === learn ? '' : esc(rm.title) + ': '}${esc(t.title)}</h4>`;
      prev = t;
      return head + row(q, (statsOf[rm.id] ||= topicStats(rm)));
    }).join('');
  };
  const counts = activity();
  let streak = 0;
  for (let d = counts[today()] ? today() : addDays(today(), -1); counts[d]; d = addDays(d, -1)) streak++;
  const ess = filters.tier ? ' Essentials only.' : '';
  main.innerHTML = `
    <section class="head">
      <div class="head-row">
        <h1>Today</h1>
        <span class="streak ${streak ? 'on' : ''}"><i class="ph ph-fire" aria-hidden="true"></i>${streak ? `${streak}-day streak` : 'Solve or review something to start a streak'}</span>
      </div>
      <p class="pace"><label>Finish the ${esc(learn.title)} by <input type="date" id="target" value="${target || ''}" min="${today()}"></label>
        <span>${days > 0 ? `${left.length} left, so ${perDay} new a day.` : target ? 'That date has passed. Pick a new one.' : `No date set, so ${DAILY_NEW} new a day.`}${ess}</span></p>
    </section>
    <section class="day">
      <h2>Reviews due <span>${due.length}</span></h2>
      ${due.length ? `<div class="card">${rows(due)}</div>` : '<p class="quiet">No reviews due today.</p>'}
    </section>
    <section class="day">
      <h2>New today <span>${solvedToday.length}/${fresh.length}</span></h2>
      ${fresh.length ? `<div class="card">${rows(fresh)}</div>` : `<p class="quiet">You have solved the whole ${esc(learn.title)}.</p>`}
    </section>
    <section class="day">
      <h2>Activity</h2>
      ${heatmap(counts)}
    </section>`;
  document.getElementById('target').onchange = e => { meta().target = e.target.value; save(); renderToday(); };
  highlightCode();
  updateDueBadge();
}
function heatmap(counts) {
  const WEEKS = 20, start = addDays(today(), -(WEEKS - 1) * 7 - new Date().getDay()); // columns start on Sunday
  let cells = '', total = 0;
  for (let d = start; d <= today(); d = addDays(d, 1)) {
    const n = counts[d] || 0;
    total += n;
    cells += `<i class="l${n >= 6 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n ? 1 : 0}" title="${n} on ${d}"></i>`;
  }
  return `<div class="heat-wrap"><div class="heat" role="img" aria-label="${total} solves and reviews in the last ${WEEKS} weeks">${cells}</div>
    <p class="heat-foot"><span>${total} ${total === 1 ? 'solve or review' : 'solves and reviews'} in ${WEEKS} weeks</span>
    <span class="legend">Less <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More</span></p></div>`;
}

// ---------- mock interview: a random unsolved question against the clock ----------
function startMock(rid) {
  const rm = roadmaps[rid];
  const pool = rm.topics.flatMap(t => t.questions).filter(q => !st(q.id).done && q.id !== mock?.q?.id);
  mock = { rid, q: pool[Math.floor(Math.random() * pool.length)] || (mock?.rid === rid && !st(mock.q?.id).done ? mock.q : null), hint: false, result: '' };
  if (mock.q) startTimer(mock.q.id, MOCK_MINUTES);
  renderMock();
}
function renderMock() {
  const { q, rid } = mock, rm = roadmaps[rid];
  main.innerHTML = `
    <section class="head">
      <div class="head-row"><h1>Mock interview</h1><a class="btn" href="/roadmap/${rid}"><i class="ph ph-arrow-left" aria-hidden="true"></i>${esc(rm.title)}</a></div>
      <p class="lede">One unsolved question, ${MOCK_MINUTES} minutes. Say your approach out loud before you code.</p>
    </section>
    ${!q ? `<div class="empty"><i class="ph ph-check-circle" aria-hidden="true"></i><p>Every question in ${esc(rm.title)} is solved.</p></div>` : `
    <div class="stage">
      <div class="meta"><span class="diff ${q.diff}">${DIFF[q.diff]}</span>${mock.hint ? `<span class="tag">${esc(q.group || byId[q.id].t.title)}</span>` : ''}</div>
      <a class="stage-title" href="${esc(qUrl(q))}" target="_blank" rel="noopener">${esc(q.title)}</a>
      ${links(q)}
      <div class="stage-clock" data-clock></div>
      ${mock.result ? `<p class="stage-result">${mock.result}</p>
        <div class="stage-actions"><button class="primary" data-mock="new">Next question <i class="ph ph-arrow-right" aria-hidden="true"></i></button></div>` : `
      <div class="stage-actions">
        <button class="btn" data-mock="topic" ${mock.hint ? 'disabled' : ''}><i class="ph ph-lightbulb" aria-hidden="true"></i>Show topic</button>
        <button class="btn" data-mock="hint">Solved with a hint</button>
        <button class="primary" data-mock="solved"><i class="ph ph-check" aria-hidden="true"></i>Solved it</button>
      </div>
      <button class="text-btn" data-mock="new"><i class="ph ph-shuffle" aria-hidden="true"></i>Skip, give me another</button>`}
    </div>`}`;
  tick();
}
function mockAction(act) {
  if (act === 'new') return startMock(mock.rid);
  if (act === 'topic') mock.hint = true;
  else {
    const over = timer?.id === mock.q.id && Date.now() - timer.start > MOCK_MINUTES * 6e4;
    solve(mock.q.id, act === 'solved' && !mock.hint ? 'alone' : 'hint');
    mock.result = `Solved in ${st(mock.q.id).mins} min${over ? `, over the ${MOCK_MINUTES}-minute limit` : ''}.`;
  }
  renderMock();
}

// ---------- pattern quiz: the "when to use" signals from the pattern notes ----------
async function loadCards() {
  const notes = noteSections().flatMap(s => s.items).filter(n => n.file.includes('notes/patterns/'));
  const cards = [];
  await Promise.all(notes.map(async note => {
    const md = await (await fetch(note.file)).text();
    const block = md.split(/^## /m).find(b => /^When to use/i.test(b)) || '';
    // Hide the answer: words from the topic's name become blanks, and "signal: answer" bullets show only the signal.
    const words = (note.title.toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !['basic', 'basics', 'maths', 'advanced', 'algorithms'].includes(w))
      .map(w => w.replace(/s$/, ''));
    const blank = s => (words.length ? s.replace(new RegExp(`\\b(${words.join('|')})\\w*`, 'gi'), '____') : s);
    for (const [, line] of block.matchAll(/^- (.+)$/gm)) {
      const cut = line.indexOf(': ');
      const answered = cut > 0 && (line.slice(cut).includes('**') || /"$/.test(line.slice(0, cut).trim()));
      const signal = answered ? line.slice(0, cut) : line;
      cards.push({ note, full: line, signal: blank(signal) });
    }
  }));
  return cards;
}
async function renderQuiz() {
  if (!quiz) {
    main.innerHTML = '<p class="quiet">Loading cards…</p>';
    quiz = { cards: await loadCards(), topic: '' };
    newDeck();
  }
  const c = quiz.deck[quiz.i];
  const topics = [...new Set(quiz.cards.map(c => c.note.title))];
  main.innerHTML = `
    <section class="head">
      <div class="head-row"><h1>Pattern quiz</h1>
        <select id="quiz-topic" class="select" aria-label="Topic"><option value="">All topics</option>${topics.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div>
      <p class="lede">Read the signal, name the technique, then check. Missed cards come back later in the deck.</p>
    </section>
    ${c ? `<div class="stage">
      <div class="stage-meta"><span>Card ${quiz.i + 1} of ${quiz.deck.length}</span><span>${quiz.right} knew, ${quiz.missed} missed</span></div>
      <p class="signal">${marked.parseInline(c.signal)}</p>
      ${quiz.shown ? `<div class="answer"><b>${esc(c.note.title)}</b><p>${marked.parseInline(c.full)}</p><a href="/notes/${c.note.id}">Open the notes</a></div>
        <div class="stage-actions"><button class="btn" data-quiz="missed"><i class="ph ph-x" aria-hidden="true"></i>Missed it</button>
        <button class="primary" data-quiz="knew"><i class="ph ph-check" aria-hidden="true"></i>Knew it</button></div>`
      : '<div class="stage-actions"><button class="primary" data-quiz="reveal">Show answer <kbd>Space</kbd></button></div>'}
    </div>` : `<div class="empty"><i class="ph ph-check-circle" aria-hidden="true"></i><p>Deck done: ${quiz.right} knew, ${quiz.missed} missed.</p>
      <button data-quiz="restart">Shuffle again</button></div>`}`;
  const sel = document.getElementById('quiz-topic');
  sel.value = quiz.topic;
  sel.onchange = () => { quiz.topic = sel.value; newDeck(); renderQuiz(); };
}
function newDeck() {
  Object.assign(quiz, { deck: shuffle(quiz.cards.filter(c => !quiz.topic || c.note.title === quiz.topic)), i: 0, shown: false, right: 0, missed: 0 });
}
function quizAction(act) {
  if (act === 'restart') newDeck();
  else if (act === 'reveal') quiz.shown = true;
  else {
    act === 'knew' ? quiz.right++ : (quiz.missed++, quiz.deck.push(quiz.deck[quiz.i]));
    quiz.i++;
    quiz.shown = false;
  }
  renderQuiz();
}

// ---------- notes ----------
function noteSections() {
  return content.notes.map(s => s.fromRoadmap
    ? { section: s.section, items: roadmaps[s.fromRoadmap].topics.filter(t => t.note).map(t => ({ id: `${s.fromRoadmap}-${t.id}`, title: t.title, file: t.note })) }
    : s);
}

async function renderNote(id) {
  const sections = noteSections();
  const note = sections.flatMap(s => s.items).find(n => n.id === id) || sections[0].items[0];
  main.innerHTML = `<div class="notes">
    <aside>${sections.map(s => `<h3>${esc(s.section)}</h3>` +
      s.items.map(n => `<a href="/notes/${n.id}" class="${n === note ? 'active' : ''}">${esc(n.title)}</a>`).join('')).join('')}</aside>
    <article class="md">Loading…</article></div>`;
  const art = main.querySelector('article');
  const res = await fetch(note.file);
  if (!res.ok) return (art.textContent = `Note not found: ${note.file}`);
  art.innerHTML = marked.parse(await res.text());
  art.querySelectorAll('pre code.language-mermaid').forEach(c => {
    const pre = c.parentElement;
    pre.className = 'mermaid';
    pre.textContent = c.textContent;
  });
  art.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
  window.scrollTo(0, 0);
  await mermaid.run({ nodes: art.querySelectorAll('pre.mermaid'), suppressErrors: true });
}

init().catch(e => (main.innerHTML = `<p class="bad">Failed to load: ${esc(e.message)}. Start the app with <code>node server.js</code>.</p>`));

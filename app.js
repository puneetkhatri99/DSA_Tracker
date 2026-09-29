// Fraction of a topic's questions you must solve before it counts as "done" for prerequisites.
// 1.0 = every question (strict build-up). Lower it (e.g. 0.8) if you want to move on sooner.
const PREREQ_DONE = 1.0;
// Spaced repetition: days until the next review after solving, then after each "Remembered".
// "Forgot" starts the ladder again. Past the last step the question counts as mastered.
const REVIEW_DAYS = [1, 3, 7, 15, 30, 60];
const DIFF = { E: 'Easy', M: 'Medium', H: 'Hard' };
const SOURCES = { A2Z: 'Striver A2Z', NC150: 'NeetCode 150', NC250: 'NeetCode 250', B75: 'Blind 75',
  LC150: 'LeetCode Top 150', LC75: 'LeetCode 75' };

const main = document.getElementById('main');
const roadmaps = {};
const filters = { src: '', diff: '', status: '', q: '' };
const openTopics = new Set(), openNotes = new Set();
let content, progress = {}, current;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getJSON = url => fetch(url).then(r => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); });
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const st = id => progress[id] || {};
const SITES = { 'leetcode.com': 'LC', 'geeksforgeeks.org': 'GFG', 'takeuforward.org': 'TUF', 'lintcode.com': 'LintCode' };
const site = url => Object.entries(SITES).find(([host]) => url.includes(host))?.[1] || 'Link';
const today = () => new Date().toLocaleDateString('en-CA');
const addDays = (date, n) => { const d = new Date(date + 'T00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
const daysUntil = date => Math.round((new Date(date + 'T00:00') - new Date(today() + 'T00:00')) / 864e5);
const isDue = s => !!s.due && s.due <= today();
const schedule = lvl => ({ lvl, due: lvl < REVIEW_DAYS.length ? addDays(today(), REVIEW_DAYS[lvl]) : '' });

mermaid.initialize({ startOnLoad: false, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });

async function init() {
  [content, progress] = await Promise.all([getJSON('content.json'), getJSON('/api/progress')]);
  for (const s of Object.values(progress)) // solved before reviews existed → first review the day after solving
    if (s.done && !s.due && !s.lvl) s.due = addDays(s.done, REVIEW_DAYS[0]);
  await Promise.all(content.roadmaps.map(async r => (roadmaps[r.id] = await getJSON(r.file))));
  document.getElementById('nav').innerHTML =
    content.roadmaps.map(r => `<a href="#/roadmap/${r.id}">${esc(r.title)}</a>`).join('') + '<a href="#/notes">Notes</a>';
  window.onhashchange = route;
  route();
}

function route() {
  const [, view, id] = location.hash.split('/');
  if (view === 'review') { // header 🔔 badge: show only what's due
    Object.assign(filters, { src: '', diff: '', status: 'due', q: '' });
    return (location.hash = `#/roadmap/${current?.id || content.roadmaps[0].id}`);
  }
  if (view === 'notes') renderNote(id);
  else renderRoadmap(roadmaps[id] ? id : content.roadmaps[0].id);
  updateDueBadge();
  document.querySelectorAll('#nav a').forEach(a =>
    a.classList.toggle('active', a.getAttribute('href') === (view === 'notes' ? '#/notes' : `#/roadmap/${current.id}`)));
}

// ---------- progress ----------
let saveTimer;
function setState(id, patch) {
  const s = { ...st(id), ...patch };
  for (const k in s) if (!s[k]) delete s[k];
  if (Object.keys(s).length) progress[id] = s;
  else delete progress[id];
  clearTimeout(saveTimer);
  showStatus('Saving…');
  saveTimer = setTimeout(() =>
    fetch('/api/progress', { method: 'PUT', body: JSON.stringify(progress) })
      .then(r => { if (!r.ok) throw new Error(r.status); showStatus('Saved'); })
      .catch(() => showStatus('Not saved! Is `node server.js` running?', true)), 400);
}
function showStatus(text, bad) {
  const el = document.getElementById('save-status');
  el.textContent = text;
  el.className = bad ? 'bad' : '';
}

// Header 🔔 badge + tab title: how many solved questions are due for review today.
function updateDueBadge() {
  const n = Object.values(progress).filter(isDue).length;
  const badge = document.getElementById('due-badge');
  badge.hidden = !n;
  badge.textContent = `🔔 ${n} due`;
  document.title = n ? `(${n}) DSA Tracker` : 'DSA Tracker';
  return n;
}

// ---------- roadmap ----------
function renderRoadmap(rid) {
  current = roadmaps[rid];
  main.innerHTML = `
    <section class="head">
      <h1>${esc(current.title)}</h1>
      <div class="bar"><i id="overall"></i></div>
      <p id="stats"></p>
      <div id="review-banner" class="banner" hidden></div>
      <div class="filters">
        <select id="f-src"><option value="">All sources</option>${Object.entries(SOURCES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <select id="f-diff"><option value="">All levels</option>${Object.entries(DIFF).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <select id="f-status"><option value="">Any status</option><option value="todo">To do</option><option value="done">Solved</option><option value="rev">Revise</option><option value="star">Starred</option><option value="due">Due for review</option></select>
        <input id="f-q" type="search" placeholder="Search questions…">
        <button id="next" class="primary">Next up →</button>
      </div>
      <details id="map"><summary>Topic map</summary><div class="map-host"></div></details>
    </section>
    <div id="list"></div>`;
  for (const k of ['src', 'diff', 'status', 'q']) {
    const el = document.getElementById('f-' + k);
    el.value = filters[k];
    el.oninput = () => { filters[k] = k === 'q' ? el.value.trim().toLowerCase() : el.value; renderList(); };
  }
  document.getElementById('next').onclick = nextUp;
  document.getElementById('map').ontoggle = e => e.target.open && renderMap();
  const list = document.getElementById('list');
  list.addEventListener('click', onListClick);
  list.addEventListener('change', e => {
    if (e.target.type !== 'checkbox') return;
    setState(rowId(e.target), e.target.checked ? { done: today(), ...schedule(0) } : { done: '', lvl: 0, due: '' });
    renderList();
  });
  list.addEventListener('input', e => {
    if (e.target.tagName !== 'TEXTAREA') return;
    setState(rowId(e.target), { note: e.target.value });
    e.target.closest('.q').querySelector('[data-act=note]').classList.toggle('on', !!e.target.value);
  });
  list.addEventListener('toggle', e => {
    const t = e.target.dataset.topic;
    if (t) e.target.open ? openTopics.add(t) : openTopics.delete(t);
  }, true);
  renderList();
}

const rowId = el => el.closest('.q').dataset.id;
const filtering = () => Object.values(filters).some(Boolean);
function visible(q) {
  const s = st(q.id);
  return (!filters.src || q.src.includes(filters.src)) && (!filters.diff || q.diff === filters.diff) &&
    (!filters.status || (filters.status === 'todo' ? !s.done : filters.status === 'due' ? isDue(s) : s[filters.status])) &&
    (!filters.q || q.title.toLowerCase().includes(filters.q));
}
function topicStats() {
  const stats = {};
  for (const t of current.topics) {
    const done = t.questions.filter(q => st(q.id).done).length;
    stats[t.id] = { done, total: t.questions.length, met: done >= PREREQ_DONE * t.questions.length, title: t.title };
  }
  return stats;
}

function renderList() {
  const stats = topicStats();
  const pool = current.topics.flatMap(t => t.questions).filter(q => !filters.src || q.src.includes(filters.src));
  const solved = pool.filter(q => st(q.id).done);
  const byDiff = d => `${DIFF[d]} ${solved.filter(q => q.diff === d).length}/${pool.filter(q => q.diff === d).length}`;
  document.getElementById('overall').style.width = pct(solved.length, pool.length) + '%';
  document.getElementById('stats').textContent =
    `${filters.src ? SOURCES[filters.src] + ': ' : ''}${solved.length} / ${pool.length} solved (${pct(solved.length, pool.length)}%) · ` +
    `${byDiff('E')} · ${byDiff('M')} · ${byDiff('H')} · ${pool.filter(q => st(q.id).rev).length} marked to revise`;
  const due = updateDueBadge();
  const banner = document.getElementById('review-banner');
  banner.hidden = !due || filters.status === 'due';
  banner.innerHTML = `🔔 <b>${due} question${due > 1 ? 's' : ''}</b> due for spaced-repetition review. ` +
    `Re-solve without looking at your old code, then mark Remembered or Forgot. <a href="#/review">Review now →</a>`;

  const chip = tid => {
    const s = stats[tid];
    return `<button class="chip ${s.met ? 'met' : ''}" data-goto="${tid}" title="${s.met ? 'Done' : 'Finish this topic first'}">` +
      `${s.met ? '✓' : '🔒'} ${esc(s.title)}${s.met ? '' : ` ${s.done}/${s.total}`}</button>`;
  };
  const row = q => {
    const s = st(q.id);
    const locked = q.needs.some(n => !stats[n].met);
    const reviewDue = isDue(s);
    const next = !s.done ? '' : reviewDue ? '' : s.due ? `review in ${daysUntil(s.due)}d` : 'mastered';
    return `<div class="q ${s.done ? 'done' : ''} ${reviewDue ? 'due' : ''} ${locked && !s.done ? 'locked' : ''}" data-id="${q.id}">
      <input type="checkbox" ${s.done ? 'checked' : ''} aria-label="Solved">
      <a class="qt" href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.title)}</a>
      <span class="diff ${q.diff}">${DIFF[q.diff]}</span>
      <span class="links">${[[site(q.url), q.url], ...Object.entries(q.alt || {})].map(([k, u]) =>
        `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(k)}</a>`).join('')}</span>
      ${q.premium ? '<span class="tag prem" title="LeetCode Premium">Premium</span>' : ''}
      ${q.src.map(x => `<span class="tag" title="${SOURCES[x]}">${x}</span>`).join('')}
      ${q.needs.length ? `<span class="needs">${q.needs.map(chip).join('')}</span>` : ''}
      <span class="acts">
        ${reviewDue ? `<span class="review">Review due <button data-act="recall">✓ Remembered</button><button data-act="forgot">✗ Forgot</button></span>` : ''}
        ${next ? `<small title="Solved ${s.done}${s.due ? ' · next review ' + s.due : ''}">${next}</small>` : ''}
        ${q.video ? `<a href="${esc(q.video)}" target="_blank" rel="noopener" title="Video solution">▶</a>` : ''}
        ${q.article ? `<a href="${esc(q.article)}" target="_blank" rel="noopener" title="Article">📄</a>` : ''}
        <button data-act="rev" class="${s.rev ? 'on' : ''}" title="Mark to revise">↻</button>
        <button data-act="star" class="${s.star ? 'on' : ''}" title="Star">★</button>
        <button data-act="note" class="${s.note ? 'on' : ''}" title="My notes">✎</button>
      </span>
      <textarea ${openNotes.has(q.id) ? '' : 'hidden'} placeholder="Approach, complexity, gotchas…">${esc(s.note || '')}</textarea>
    </div>`;
  };

  document.getElementById('list').innerHTML = current.topics.map((t, i) => {
    const qs = t.questions.filter(visible);
    if (filtering() && !qs.length) return '';
    const s = stats[t.id];
    const groups = [];
    for (const q of qs) (groups.at(-1)?.[0] === q.group ? groups.at(-1)[1] : groups[groups.push([q.group, []]) - 1][1]).push(q);
    return `<details class="topic" id="t-${t.id}" data-topic="${t.id}" ${openTopics.has(t.id) || filters.q || filters.status === 'due' ? 'open' : ''}>
      <summary>
        <span class="num">${i + 1}</span>
        <span class="title">${esc(t.title)}</span>
        <span class="count">${s.done}/${s.total}</span>
        <span class="bar small"><i style="width:${pct(s.done, s.total)}%"></i></span>
        ${t.prereqs.length ? `<span class="needs">${t.prereqs.map(chip).join('')}</span>` : ''}
        ${t.note ? `<a class="note-link" href="#/notes/${current.id}-${t.id}">📘 Pattern notes</a>` : ''}
      </summary>
      ${groups.map(([g, list]) => `<h4>${esc(g)}</h4>${list.map(row).join('')}`).join('')}
    </details>`;
  }).join('') || '<p class="empty">No questions match these filters.</p>';
  if (document.getElementById('map').open) renderMap();
}

function onListClick(e) {
  const goto = e.target.closest('[data-goto]');
  if (goto) { e.preventDefault(); return focusEl(document.getElementById('t-' + goto.dataset.goto)); }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = rowId(btn), act = btn.dataset.act;
  if (act === 'recall' || act === 'forgot') {
    setState(id, schedule(act === 'recall' ? (st(id).lvl || 0) + 1 : 0));
    return renderList();
  }
  if (act === 'note') {
    const ta = btn.closest('.q').querySelector('textarea');
    ta.hidden = !ta.hidden;
    ta.hidden ? openNotes.delete(id) : (openNotes.add(id), ta.focus());
    return;
  }
  setState(id, { [act]: !st(id)[act] });
  renderList();
}

function focusEl(el) {
  if (!el) return;
  const topic = el.closest('details.topic');
  topic.open = true;
  openTopics.add(topic.dataset.topic);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  lines.push('  classDef done fill:#2e7d32,stroke:#1b5e20,color:#fff', '  classDef wip fill:#f9a825,stroke:#f57f17,color:#000',
    '  classDef todo fill:transparent');
  mermaid.render('topic-map-' + Date.now(), lines.join('\n'))
    .then(({ svg }) => (document.querySelector('.map-host').innerHTML = svg))
    .catch(e => console.warn('topic map', e));
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
      s.items.map(n => `<a href="#/notes/${n.id}" class="${n === note ? 'active' : ''}">${esc(n.title)}</a>`).join('')).join('')}</aside>
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

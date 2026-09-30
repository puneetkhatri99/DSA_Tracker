// Validates content.json, every roadmap and every note file. Run: node check.js
const fs = require('fs');
const path = require('path');

const read = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const exists = f => fs.existsSync(path.join(__dirname, f));
const errors = [];
const fail = msg => errors.push(msg);
const DIFFS = ['E', 'M', 'H'];
const TIERS = ['basic', 'core', 'pro'];

const content = read('content.json');
const seen = new Set();
for (const r of content.roadmaps) {
  if (!exists(r.file)) { fail(`roadmap file missing: ${r.file}`); continue; }
  const rm = read(r.file);
  const order = {};
  rm.topics.forEach((t, i) => {
    if (order[t.id] !== undefined) fail(`${r.id}: duplicate topic ${t.id}`);
    order[t.id] = i;
  });
  const counts = {};
  for (const t of rm.topics) {
    const before = x => order[x] !== undefined && order[x] < order[t.id];
    for (const p of t.prereqs) if (!before(p)) fail(`${t.id}: prereq "${p}" must be an earlier topic`);
    if (t.note && !exists(t.note)) fail(`${t.id}: note missing ${t.note}`);
    for (const q of t.questions) {
      const where = `${t.id}/${q.id}`;
      if (seen.has(q.id)) fail(`duplicate question id ${q.id}`);
      seen.add(q.id);
      if (!q.title || !/^https?:\/\//.test(q.url || '')) fail(`${where}: needs title and http(s) url`);
      if (!DIFFS.includes(q.diff)) fail(`${where}: diff must be E/M/H`);
      for (const [label, u] of Object.entries(q.alt || {})) if (!/^https?:\/\//.test(u)) fail(`${where}: alt link "${label}" must be an http(s) url`);
      if (!Array.isArray(q.needs)) fail(`${where}: needs must be an array (use [] if none)`);
      if (q.tier !== undefined && !TIERS.includes(q.tier)) fail(`${where}: tier must be basic/core/pro`);
      if (q.patterns !== undefined && !(Array.isArray(q.patterns) && q.patterns.every(p => typeof p === 'string' && p))) fail(`${where}: patterns must be a list of names`);
      for (const k of [q.diff, q.tier]) if (k) counts[k] = (counts[k] || 0) + 1;
      for (const n of q.needs || []) if (!before(n)) fail(`${where}: need "${n}" must be an earlier topic`);
    }
  }
  const total = rm.topics.reduce((a, t) => a + t.questions.length, 0);
  console.log(`${r.id}: ${rm.topics.length} topics, ${total} questions`, counts);
}
for (const s of content.notes)
  for (const n of s.items || []) if (!exists(n.file)) fail(`note missing: ${n.file}`);

if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ` + errors.join('\n- '));
  process.exit(1);
}
console.log('OK');

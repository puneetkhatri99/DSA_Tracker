// Zero-dependency server: serves this folder + saves progress to progress.json.
// Run: node server.js  →  http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const PROGRESS = path.join(ROOT, 'progress.json');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.md': 'text/markdown', '.svg': 'image/svg+xml', '.png': 'image/png' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  if (url === '/api/progress') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(fs.existsSync(PROGRESS) ? fs.readFileSync(PROGRESS) : '{}');
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', c => (body += c));
      return req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('not an object');
          // write-then-rename so a crash mid-write never corrupts existing progress
          fs.writeFileSync(PROGRESS + '.tmp', JSON.stringify(data, null, 1));
          fs.renameSync(PROGRESS + '.tmp', PROGRESS);
          res.writeHead(204).end();
        } catch (e) {
          res.writeHead(400).end('bad progress json: ' + e.message);
        }
      });
    }
    return res.writeHead(405).end();
  }

  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'Content-Type': (TYPES[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`DSA tracker → http://localhost:${PORT}`));

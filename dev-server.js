// Servidor local de desarrollo: `node dev-server.js` -> http://localhost:3000
// Usa datos en memoria si no hay variables de Upstash/KV configuradas.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const handlers = {
  auth: require('./api/auth'),
  data: require('./api/data'),
  book: require('./api/book')
};

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/api/')) {
    const name = u.pathname.slice(5);
    const h = handlers[name];
    if (!h) { res.statusCode = 404; return res.end('{}'); }
    let raw = '';
    for await (const ch of req) raw += ch;
    req.query = Object.fromEntries(u.searchParams);
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
    return h(req, res);
  }
  const file = path.join(__dirname, 'public', u.pathname === '/' ? 'index.html' : u.pathname);
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain');
    res.end(data);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));

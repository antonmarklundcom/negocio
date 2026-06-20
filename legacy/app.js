/**
 * app.js — minimal zero-dependency static server for negocio.com.py (Build 1)
 *
 * Serves the static blueprint pages so they run as a Hostinger Node.js app.
 * No frameworks, no npm dependencies — nothing to break on shared hosting.
 * When we add JetEngine data later, this gets replaced by a Next.js server.
 *
 * Hostinger Node.js setup:
 *   Application startup file : app.js
 *   Application root         : (this repo)
 *   Node version            : 18+   (uses only the core 'http'/'fs'/'path')
 * Hostinger passes the port via process.env.PORT.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.txt':  'text/plain; charset=utf-8',
};

// Clean routes → files (so /negocio works as well as /negocio.html)
const ROUTES = {
  '/':          'index.html',
  '/negocio':   'negocio.html',
  '/categoria': 'categoria.html',
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }

  // map clean routes, otherwise treat as a file path
  let rel = ROUTES[urlPath] || urlPath.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  if (!path.extname(rel)) rel += '.html';        // /foo → foo.html

  // resolve safely inside ROOT (block path traversal)
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    return send(res, 403, 'Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      const notFound = path.join(ROOT, '404.html');
      return fs.readFile(notFound, (e2, page) =>
        e2 ? send(res, 404, 'Not found')
           : send(res, 404, page, MIME['.html']));
    }
    send(res, 200, data, MIME[path.extname(filePath)] || 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log(`negocio.com.py frontend running on port ${PORT}`);
});

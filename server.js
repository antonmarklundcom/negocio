/**
 * server.js — production entry point for Hostinger's Node.js (Passenger) host.
 *
 * Hostinger runs a single "Entry file" with Node (not `next start`), so this
 * boots Next.js programmatically and serves the already-built `.next` output.
 *
 * Hostinger config that goes with this file:
 *   Build command : npm run build      (must run BEFORE this starts)
 *   Entry file    : server.js
 *   Node version  : 22.x
 * Passenger provides the port/socket via process.env.PORT.
 */
const { createServer } = require('http');
const next = require('next');

const port = process.env.PORT || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, () => {
      console.log(`negocio.com.py running (production) on ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start Next.js server:', err);
    process.exit(1);
  });

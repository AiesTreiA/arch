#!/usr/bin/env node
/**
 * server.mjs — Servidor HTTP estático minimalista (0 dependencias) para probar ARCH en local.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function createDevServer() {
  return http.createServer((req, res) => {
    const cleanUrl = String(req.url || '/').split('?')[0];
    const rel = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
    const abs = path.resolve(ROOT, rel);
    if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(abs);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(abs).pipe(res);
  });
}

function startServer(port, maxAttempts = 10) {
  const srv = createDevServer();

  srv.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && maxAttempts > 0) {
      console.warn(`[arch] Puerto ${port} en uso. Intentando en ${port + 1}...`);
      startServer(port + 1, maxAttempts - 1);
    } else {
      console.error(`[arch] Error al iniciar servidor:`, err.message);
      process.exit(1);
    }
  });

  srv.listen(port, '127.0.0.1', () => {
    console.log(`[arch] Servidor listo en http://127.0.0.1:${port}`);
    console.log(`[arch] Abre http://localhost:${port} en tu navegador`);
  });
}

startServer(PORT);

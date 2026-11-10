import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import publicoHandler from './api/publico.js';
import conteudoHandler from './api/conteudo.js';
import adminHandler from './api/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const BLOCKED_PREFIXES = ['/api/', '/turso/', '/node_modules/', '/.git', '/.env', '/package'];

function readRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || 'localhost';
    const urlObj = new URL(req.url || '/', `http://${host}`);
    const pathname = decodeURIComponent(urlObj.pathname);

    // 1. Rotas de API Serverless (/api/publico, /api/conteudo, /api/admin)
    if (pathname === '/api/publico' || pathname === '/api/conteudo' || pathname === '/api/admin') {
      req.query = Object.fromEntries(urlObj.searchParams.entries());
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const raw = await readRawBody(req);
        try {
          req.body = raw ? JSON.parse(raw) : {};
        } catch {
          req.body = raw;
        }
      }
      if (pathname === '/api/publico') return await publicoHandler(req, res);
      if (pathname === '/api/conteudo') return await conteudoHandler(req, res);
      if (pathname === '/api/admin') return await adminHandler(req, res);
    }

    // 2. Bloqueio de segurança para arquivos internos
    if (BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado');
    }

    // 3. Resolução de arquivos estáticos (com suporte a URLs limpas sem .html)
    let relPath = pathname === '/' ? '/index.html' : pathname;
    let filePath = path.join(__dirname, relPath);

    // Previne Path Traversal
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      return res.end('Acesso negado');
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const htmlCandidate = `${filePath}.html`;
      if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
        filePath = htmlCandidate;
      } else {
        const indexFallback = path.join(__dirname, 'index.html');
        if (fs.existsSync(indexFallback)) {
          filePath = indexFallback;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Página não encontrada');
        }
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const cacheHeader = ext === '.html'
      ? 'no-cache'
      : 'public, max-age=604800, immutable';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheHeader,
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Erro interno do servidor');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Natalie Thedim ativo na porta ${PORT}`);
});

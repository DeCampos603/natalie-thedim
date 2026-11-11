import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import publicoHandler from './api/publico.js';
import conteudoHandler from './api/conteudo.js';
import adminHandler from './api/admin.js';
import notificarHandler from './api/notificar.js';

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

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB
const BLOCKED_PREFIXES = ['/api/', '/turso/', '/hostinger/', '/node_modules/', '/.git', '/.env', '/.vercel', '/package'];
const BLOCKED_FILES = ['/server.js', '/.htaccess', '/.gitignore', '/vercel.json', '/package.json', '/package-lock.json', '/readme.md'];
const BLOCKED_EXTENSIONS = ['.zip', '.tar', '.gz', '.sql', '.env', '.md', '.log', '.bak', '.sh', '.py', '.mjs'];

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let oversized = false;
    req.on('data', (c) => {
      if (oversized) return;
      total += c.length;
      if (total > MAX_BODY_BYTES) {
        oversized = true;
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!oversized) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', () => {
      if (!oversized) resolve('');
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    // Cabeçalhos Globais de Segurança (OWASP Best Practices)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    const host = req.headers.host || 'localhost';
    const urlObj = new URL(req.url || '/', `http://${host}`);
    let pathname;
    try {
      pathname = decodeURIComponent(urlObj.pathname);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Bad Request');
      return;
    }

    // 1. Rotas de API Serverless (/api/publico, /api/conteudo, /api/admin, /api/notificar)
    if (pathname === '/api/publico' || pathname === '/api/conteudo' || pathname === '/api/admin' || pathname === '/api/notificar') {
      res.setHeader('Cache-Control', 'no-store');
      req.query = Object.fromEntries(urlObj.searchParams.entries());
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        let raw = '';
        try {
          raw = await readRawBody(req);
        } catch (bodyErr) {
          res.statusCode = bodyErr.statusCode || 413;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, erro: 'Requisicao excede o limite permitido (1 MB).' }));
          return;
        }
        try {
          req.body = raw ? JSON.parse(raw) : {};
        } catch {
          req.body = raw;
        }
      }
      if (pathname === '/api/publico') return await publicoHandler(req, res);
      if (pathname === '/api/conteudo') return await conteudoHandler(req, res);
      if (pathname === '/api/admin') return await adminHandler(req, res);
      if (pathname === '/api/notificar') return await notificarHandler(req, res);
    }

    // 2. Bloqueio de segurança para arquivos internos, código-fonte e backups
    const extBaixa = path.extname(pathname).toLowerCase();
    const lowerPath = pathname.toLowerCase();
    const hasDotSegment = lowerPath.split('/').some((seg) => seg.startsWith('.') && seg !== '.well-known' && seg !== '');
    if (
      hasDotSegment ||
      BLOCKED_PREFIXES.some((p) => lowerPath.startsWith(p)) ||
      BLOCKED_FILES.includes(lowerPath) ||
      BLOCKED_EXTENSIONS.includes(extBaixa)
    ) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado');
    }

    // 3. Resolução de arquivos estáticos (com suporte a URLs limpas sem .html)
    const cleanSlug = pathname.replace(/^\/+|\/+$/g, '');
    let relPath = pathname === '/' ? '/index.html' : (cleanSlug === 'login' ? '/admin.html' : pathname);
    let filePath = path.resolve(__dirname, '.' + relPath);

    // Previne Path Traversal
    if (filePath !== __dirname && !filePath.startsWith(__dirname + path.sep)) {
      res.writeHead(403);
      return res.end('Acesso negado');
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const cleanHtml = (!extBaixa && cleanSlug) ? path.join(__dirname, `${cleanSlug}.html`) : '';
      if (cleanHtml && fs.existsSync(cleanHtml) && fs.statSync(cleanHtml).isFile()) {
        filePath = cleanHtml;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not Found');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const cacheHeader = ext === '.html'
      ? 'no-cache'
      : 'public, max-age=31536000, immutable';

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

if (process.env.NATALIE_NO_LISTEN !== '1') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Natalie Thedim ativo na porta ${PORT}`);
  });
}

export { server };

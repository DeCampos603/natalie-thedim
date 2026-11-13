import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import publicoHandler from './api/publico.js';
import conteudoHandler from './api/conteudo.js';
import adminHandler from './api/admin.js';
import notificarHandler from './api/notificar.js';
import { tratarMcp } from './api/_agente.js';
import { htmlParaMarkdown, prefereMarkdown } from './api/_markdown.js';

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
const BLOCKED_PREFIXES = ['/api/', '/turso/', '/hostinger/', '/tools/', '/node_modules/', '/.git', '/.env', '/.vercel', '/package'];
const BLOCKED_FILES = ['/server.js', '/.htaccess', '/.gitignore', '/vercel.json', '/package.json', '/package-lock.json', '/readme.md'];
const BLOCKED_EXTENSIONS = ['.zip', '.tar', '.gz', '.sql', '.env', '.md', '.log', '.bak', '.sh', '.py', '.mjs'];

// Fonte única da lista de bloqueio. Vale para o caminho pedido E para o arquivo já resolvido em
// disco, porque "/%2Fapi/x" decodifica para "//api/x": não casa com "/api/", mas path.resolve o
// normaliza para <pasta>/api/x e serviria o código-fonte.
function ehBloqueado(caminho) {
  const lower = caminho.toLowerCase();
  const extBaixa = path.extname(lower);
  const hasDotSegment = lower.split('/').some((seg) => seg.startsWith('.') && seg !== '.well-known' && seg !== '');
  return (
    hasDotSegment ||
    BLOCKED_PREFIXES.some((p) => lower.startsWith(p)) ||
    BLOCKED_FILES.includes(lower) ||
    BLOCKED_EXTENSIONS.includes(extBaixa)
  );
}

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

    // Endereço único: domínio sem "www" (o mesmo do canonical). Não força HTTPS aqui: o HTTPS é
    // ativado no hPanel (SSL > "Forçar HTTPS"); redirecionar por cabeçalho do proxy pode gerar laço.
    const hostSemPorta = host.split(':')[0].toLowerCase();
    if (hostSemPorta.startsWith('www.') && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(301, { Location: `https://${hostSemPorta.slice(4)}${req.url || '/'}` });
      return res.end();
    }

    let pathname;
    try {
      pathname = decodeURIComponent(urlObj.pathname);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Bad Request');
      return;
    }

    // Caminho ambíguo (barras duplicadas, contrabarra, byte nulo): nenhuma página legítima usa.
    if (pathname.includes('\\') || pathname.includes('\0') || /\/{2,}/.test(pathname)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado');
    }

    // Painel administrativo fora do índice do Google (mesmo com a meta robots na página)
    if (/^\/(admin|login)(\.html)?\/?$/i.test(urlObj.pathname)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }

    // Servidor MCP somente leitura (informações públicas). Streamable HTTP, sem estado, com CORS aberto
    // porque não há credencial nem dado pessoal.
    if (pathname === '/mcp') {
      const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id',
        'Cache-Control': 'no-store',
      };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      if (req.method !== 'POST') {
        res.writeHead(405, { ...cors, Allow: 'POST, OPTIONS', 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Use POST com JSON-RPC (MCP Streamable HTTP).');
      }
      let corpo;
      try {
        corpo = JSON.parse(await readRawBody(req));
      } catch (e) {
        const codigo = e && e.statusCode === 413 ? 413 : 400;
        res.writeHead(codigo, { ...cors, 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido ou grande demais' } }));
      }
      const r = tratarMcp(corpo);
      if (r.body === null) { res.writeHead(r.status, cors); return res.end(); }
      res.writeHead(r.status, { ...cors, 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(r.body));
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
    if (ehBloqueado(pathname)) {
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

    // Segunda barreira: confere o caminho REAL resolvido, não o texto da URL.
    const relReal = '/' + path.relative(__dirname, filePath).split(path.sep).join('/');
    if (ehBloqueado(relReal)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    // HTML sempre revalida. CSS/JS não têm hash no nome, então cache curto: uma edição (ex.: IDs do
    // Google em analytics-config.js) precisa chegar a quem já visitou o site. Imagens/fontes: 30 dias.
    let cacheHeader;
    if (ext === '.html') cacheHeader = 'no-cache';
    else if (ext === '.css' || ext === '.js' || ext === '.mjs' || ext === '.json' || ext === '.xml' || ext === '.txt') cacheHeader = 'public, max-age=3600, must-revalidate';
    else cacheHeader = 'public, max-age=2592000';

    const cabecalhos = { 'Content-Type': contentType, 'Cache-Control': cacheHeader };

    if (ext === '.html') {
      // Descoberta para agentes (RFC 8288) e negociação de conteúdo (HTML x Markdown).
      cabecalhos.Vary = 'Accept';
      cabecalhos.Link = [
        '</llms.txt>; rel="describedby"; type="text/plain"',
        '</sitemap.xml>; rel="sitemap"; type="application/xml"',
        '</.well-known/mcp/server-card.json>; rel="describedby"; type="application/json"',
        '<' + (pathname === '/' ? '/' : '/' + path.basename(filePath, '.html')) + '>; rel="alternate"; type="text/markdown"',
      ].join(', ');

      if ((req.method === 'GET' || req.method === 'HEAD') && prefereMarkdown(req.headers.accept)) {
        const html = fs.readFileSync(filePath, 'utf8');
        const slug = path.basename(filePath, '.html');
        const md = htmlParaMarkdown(html, `https://nataliethedim.com.br${slug === 'index' ? '/' : '/' + slug}`);
        res.writeHead(200, {
          ...cabecalhos,
          'Content-Type': 'text/markdown; charset=utf-8',
          'x-markdown-tokens': String(Math.ceil(md.length / 4)),
        });
        return res.end(req.method === 'HEAD' ? undefined : md);
      }
    }

    // O cartão do servidor MCP é público e pode ser lido por agentes em navegador.
    if (pathname === '/.well-known/mcp/server-card.json') cabecalhos['Access-Control-Allow-Origin'] = '*';

    res.writeHead(200, cabecalhos);
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

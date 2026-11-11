import { getTursoClient } from '../turso/db.js';
import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export const TABELAS = {
  historias: { min: 10, max: 3000, extra: [] },
  cartas: { min: 10, max: 4000, extra: ['destinatario'] },
  perguntas: { min: 5, max: 1000, extra: [] },
  diario_posts: { min: 3, max: 280, extra: [] }
};
export const STATUS = ['pendente', 'aprovado', 'rejeitado'];
export const COOKIE = 'nt_admin';
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const agoraSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function slugify(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function safeHttpUrl(url) {
  const s = String(url ?? '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.toString() : '';
  } catch {
    return '';
  }
}

export async function checarLimite(req, janelaS = 600, maxEnvios = 5) {
  const h = ipHash(req);
  const agora = Math.floor(Date.now() / 1000);
  const cont = await db().execute({
    sql: 'SELECT COUNT(*) AS n FROM limite_envios WHERE ip_hash = ? AND criado_em > ?',
    args: [h, agora - janelaS]
  });
  return {
    bloqueado: Number(cont.rows?.[0]?.n || 0) >= maxEnvios,
    h,
    agora
  };
}

export async function consumirLimite(req, janelaS = 600, maxEnvios = 5) {
  const res = await checarLimite(req, janelaS, maxEnvios);
  if (res.bloqueado) return res;
  await db().batch([
    { sql: 'INSERT INTO limite_envios (ip_hash, criado_em) VALUES (?, ?)', args: [res.h, res.agora] },
    { sql: 'DELETE FROM limite_envios WHERE criado_em < ?', args: [res.agora - 86400] }
  ], 'write');
  return res;
}

export function mapTemaBiblioteca(row = {}) {
  const texto = row.texto ?? row.conteudo ?? '';
  const pilar = row.pilar ?? row.categoria ?? 'Casamento e Relacionamentos';
  return {
    ...row,
    pilar,
    categoria: pilar,
    texto,
    conteudo: texto,
    icone: row.icone || '💬',
    resumo: row.resumo ?? String(texto).slice(0, 160),
    total_mensagens: Number(row.total_mensagens || 0)
  };
}

export function mapFilme(row = {}) {
  const direcaoAno = String(row.direcao_ano || '').trim();
  let diretor = direcaoAno;
  let ano = '';
  const m = /^(.+?)\s*[·|]\s*(\d{4})$/.exec(direcaoAno);
  if (m) {
    diretor = m[1].trim();
    ano = m[2];
  } else if (/^\d{4}$/.test(direcaoAno)) {
    diretor = '';
    ano = direcaoAno;
  }
  let link = '';
  let perguntas = row.perguntas || '';
  if (typeof perguntas === 'string' && perguntas.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(perguntas);
      if (parsed && parsed.link) link = safeHttpUrl(parsed.link);
    } catch {}
  }
  const categoria = row.badge || 'Curadoria Clínica';
  return {
    ...row,
    badge: categoria,
    categoria,
    diretor,
    ano,
    link
  };
}

export function mapLivro(row = {}) {
  const sinopseRaw = String(row.sinopse || '').trim();
  let link = '';
  let sinopse = sinopseRaw;
  if (sinopseRaw.startsWith('{')) {
    try {
      const parsed = JSON.parse(sinopseRaw);
      if (parsed && parsed.link) {
        link = safeHttpUrl(parsed.link);
        sinopse = parsed.sinopse || '';
      }
    } catch {}
  }
  const categoria = row.badge || 'Biblioterapia';
  const analise = row.licao || sinopse || '';
  return {
    ...row,
    badge: categoria,
    categoria,
    autor: row.autor_ano || '',
    sinopse,
    analise,
    link
  };
}

export function db() {
  return getTursoClient();
}

export const novoId = () => randomUUID();

export function responder(res, status, corpo) {
  if (typeof res.status === 'function') {
    res.status(status);
  } else {
    res.statusCode = status;
  }
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  const payload = JSON.stringify(corpo);
  if (typeof res.send === 'function') {
    res.send(payload);
  } else if (typeof res.end === 'function') {
    res.end(payload);
  }
}

export function lerBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export function ipHash(req) {
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  return createHash('sha256').update(ip + (process.env.JWT_SECRET || '')).digest('hex').slice(0, 24);
}

const b64Url = (str) => Buffer.from(str).toString('base64url');
const b64Decode = (str) => Buffer.from(str, 'base64url').toString('utf8');

const obterSegredo = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET ausente ou curto (mínimo 32 caracteres)');
  return s;
};

export async function criarSessao(dados = {}) {
  const secret = obterSegredo();
  const header = b64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64Url(JSON.stringify({
    adm: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 8 * 3600,
    ...dados
  }));
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export async function sessaoValida(req) {
  let token = null;
  const m = /(?:^|;\s*)nt_admin=([^;]+)/.exec(req.headers.cookie || '');
  if (m) token = m[1];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }
  if (!token) return false;

  const partes = token.split('.');
  if (partes.length !== 3) return false;
  const [header, payload, signature] = partes;

  try {
    const secret = obterSegredo();
    const sigEsperada = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature.length !== sigEsperada.length) return false;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sigEsperada))) return false;

    const dec = JSON.parse(b64Decode(payload));
    if (dec.exp && Math.floor(Date.now() / 1000) > dec.exp) return false;
    return dec.adm === true;
  } catch {
    return false;
  }
}

export function iguais(a, b) {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
}

export function cookieSessao(valor, maxAge, req = null) {
  const host = String(req?.headers?.host || '').toLowerCase();
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const secureAttr = isLocal ? '' : ' Secure;';
  return `${COOKIE}=${valor}; Path=/; HttpOnly;${secureAttr} SameSite=Strict; Max-Age=${maxAge}`;
}

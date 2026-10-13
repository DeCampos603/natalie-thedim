import { getTursoClient } from '../turso/db.js';
import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export const TABELAS = {
  historias: { min: 10, max: 3000, extra: [] },
  cartas: { min: 10, max: 4000, extra: ['destinatario'] },
  perguntas: { min: 5, max: 1000, extra: [] },
  diario_posts: { min: 3, max: 280, extra: [] },
};
export const STATUS = ['pendente', 'aprovado', 'rejeitado'];
export const COOKIE = 'nt_admin';

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

export function cookieSessao(valor, maxAge) {
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

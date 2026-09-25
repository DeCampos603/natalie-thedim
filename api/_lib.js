import { createClient } from '@libsql/client';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export const TABELAS = {
  historias: { min: 10, max: 3000, extra: [] },
  cartas: { min: 10, max: 4000, extra: ['destinatario'] },
  perguntas: { min: 5, max: 1000, extra: [] },
  diario_posts: { min: 3, max: 280, extra: [] },
};
export const STATUS = ['pendente', 'aprovado', 'rejeitado'];
export const COOKIE = 'nt_admin';

let cliente;
export function db() {
  if (!cliente) {
    cliente = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return cliente;
}

export const novoId = () => randomUUID();

export function responder(res, status, corpo) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(corpo));
}

export function lerBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export function ipHash(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  return createHash('sha256').update(ip + (process.env.JWT_SECRET || '')).digest('hex').slice(0, 24);
}

const segredo = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET ausente ou curto');
  return new TextEncoder().encode(s);
};

export async function criarSessao() {
  return new SignJWT({ adm: true }).setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime('8h').sign(segredo());
}

export async function sessaoValida(req) {
  const m = /(?:^|;\s*)nt_admin=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  try { const { payload } = await jwtVerify(m[1], segredo()); return payload.adm === true; } catch { return false; }
}

export function iguais(a, b) {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
}

export function cookieSessao(valor, maxAge) {
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

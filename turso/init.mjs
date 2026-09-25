import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
await db.executeMultiple(sql);
const r = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log('Tabelas:', r.rows.map((x) => x.name).join(', '));

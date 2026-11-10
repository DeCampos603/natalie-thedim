// Cliente unificado do Banco de Dados · Natalie Thedim
// Suporta comutação automática entre:
// 1. MySQL Nativo Hostinger (quando DB_TYPE=mysql ou MYSQL_DATABASE estiver configurado)
// 2. Turso Cloud / libSQL (padrão atual) com fallback HTTP resiliente
import mysql from 'mysql2/promise';

let clientInstance = null;
let mysqlPoolInstance = null;

function traduzirParaMySQL(sql) {
  let s = sql;
  // Converte ON CONFLICT(col) DO UPDATE SET ... em ON DUPLICATE KEY UPDATE ...
  s = s.replace(/ON\s+CONFLICT\([^)]+\)\s+DO\s+UPDATE\s+SET/gi, 'ON DUPLICATE KEY UPDATE');
  s = s.replace(/excluded\.([a-zA-Z0-9_]+)/gi, 'VALUES($1)');
  // Converte funções de data SQLite para MySQL
  s = s.replace(/datetime\('now'\)/gi, 'NOW()');
  s = s.replace(/strftime\([^)]+\)/gi, 'NOW()');
  return s;
}

function criarClienteMySQL() {
  if (mysqlPoolInstance) return mysqlPoolInstance;

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  });

  async function execute(stmt) {
    const rawSql = typeof stmt === 'string' ? stmt : stmt.sql;
    const args = typeof stmt === 'string' ? [] : (stmt.args || []);
    const sql = traduzirParaMySQL(rawSql);

    const [rows, fields] = await pool.query(sql, args);
    const affected = (rows && typeof rows.affectedRows === 'number') ? rows.affectedRows : (Array.isArray(rows) ? rows.length : 0);

    return {
      rows: Array.isArray(rows) ? rows : [],
      rowsAffected: affected,
      lastInsertRowid: rows?.insertId
    };
  }

  async function batch(stmts, mode = 'write') {
    const conn = await pool.getConnection();
    try {
      if (mode === 'write') await conn.beginTransaction();
      const results = [];
      for (const s of stmts) {
        const rawSql = typeof s === 'string' ? s : s.sql;
        const args = typeof s === 'string' ? [] : (s.args || []);
        const sql = traduzirParaMySQL(rawSql);
        const [rows] = await conn.query(sql, args);
        results.push(rows);
      }
      if (mode === 'write') await conn.commit();
      return results;
    } catch (err) {
      if (mode === 'write') await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  mysqlPoolInstance = { execute, batch, tipo: 'mysql' };
  return mysqlPoolInstance;
}

function getEndpoint(rawUrl) {
  let url = rawUrl.trim();
  if (url.startsWith('libsql://')) {
    url = url.replace('libsql://', 'https://');
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url.replace(/\/+$/, '') + '/v2/pipeline';
}

function parseCell(cell) {
  if (!cell || cell.type === 'null') return null;
  if (cell.type === 'integer') return Number(cell.value);
  if (cell.type === 'float') return Number(cell.value);
  return cell.value;
}

function parseRows(cols = [], rows = []) {
  const colNames = cols.map(c => c.name);
  return rows.map(r => {
    const obj = {};
    r.forEach((cell, i) => {
      obj[colNames[i]] = parseCell(cell);
    });
    return obj;
  });
}

function toArgValue(val) {
  if (val === null || val === undefined) return { type: 'null' };
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? { type: 'integer', value: String(val) }
      : { type: 'float', value: val };
  }
  if (typeof val === 'boolean') {
    return { type: 'integer', value: val ? '1' : '0' };
  }
  return { type: 'text', value: String(val) };
}

function buildStmt(stmt) {
  const sql = typeof stmt === 'string' ? stmt : stmt.sql;
  const rawArgs = typeof stmt === 'string' ? [] : (stmt.args || []);
  const args = Array.isArray(rawArgs)
    ? rawArgs.map(toArgValue)
    : Object.entries(rawArgs).map(([k, v]) => ({ name: k, ...toArgValue(v) }));

  const res = { sql };
  if (args.length > 0) res.args = args;
  return res;
}

function createHttpFallbackClient(rawUrl, authToken) {
  const endpoint = getEndpoint(rawUrl);

  async function execute(stmt) {
    const payload = {
      requests: [{ type: 'execute', stmt: buildStmt(stmt) }]
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    const result = data.results?.[0];

    if (!res.ok || result?.type === 'error') {
      const msg = result?.error?.message || `Erro Turso HTTP ${res.status}`;
      throw new Error(msg);
    }

    const execResult = result?.response?.result || {};
    return {
      columns: (execResult.cols || []).map(c => c.name),
      rows: parseRows(execResult.cols, execResult.rows),
      rowsAffected: execResult.affected_row_count || 0,
      lastInsertRowid: execResult.last_insert_rowid
    };
  }

  async function batch(stmts, mode = 'write') {
    const requests = stmts.map(s => ({ type: 'execute', stmt: buildStmt(s) }));
    if (mode === 'write') {
      requests.unshift({ type: 'begin' });
      requests.push({ type: 'commit' });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });

    const data = await res.json();
    for (const r of data.results || []) {
      if (r.type === 'error') throw new Error(r.error?.message || 'Falha em transação Turso');
    }
    return data.results;
  }

  return { execute, batch, tipo: 'turso' };
}

/**
 * Retorna uma instância singleton do cliente de banco (MySQL Hostinger ou Turso)
 */
export function getTursoClient() {
  if (clientInstance) return clientInstance;

  // 1. Prioriza MySQL nativo caso as variáveis da Hostinger estejam configuradas
  if (process.env.DB_TYPE === 'mysql' || (process.env.MYSQL_DATABASE && process.env.MYSQL_USER)) {
    console.log('[db] Conectado ao MySQL nativo da Hostinger.');
    clientInstance = criarClienteMySQL();
    return clientInstance;
  }

  // 2. Conexão Turso Cloud (padrão)
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('Configuração ausente: TURSO_DATABASE_URL ou MYSQL_DATABASE não definidos nas variáveis de ambiente.');
  }

  clientInstance = createHttpFallbackClient(url, authToken);
  return clientInstance;
}

export async function executeQuery(sql, args = []) {
  const db = getTursoClient();
  return await db.execute({ sql, args });
}

export async function executeBatch(statements, mode = 'write') {
  const db = getTursoClient();
  return await db.batch(statements, mode);
}

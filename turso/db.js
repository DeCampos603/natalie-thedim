// Cliente unificado do Turso / libSQL
// Suporta a SDK @libsql/client com fallback nativo para Hrana v2 sobre HTTP (zero dependências)

let clientInstance = null;

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

/**
 * Cliente HTTP nativo para o Turso (compatível com a API da SDK @libsql/client)
 */
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

  async function executeMultiple(sql) {
    const commands = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const cmd of commands) {
      await execute(cmd);
    }
  }

  return { execute, batch, executeMultiple };
}

/**
 * Retorna uma instância singleton do cliente Turso/libSQL.
 */
export function getTursoClient() {
  if (clientInstance) return clientInstance;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('Configuração ausente: TURSO_DATABASE_URL não definida nas variáveis de ambiente.');
  }

  if (!url.startsWith('file:') && !authToken) {
    throw new Error('Configuração ausente: TURSO_AUTH_TOKEN não definida para conexão remota.');
  }

  // Fallback nativo ultra-resiliente via HTTP pipeline
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

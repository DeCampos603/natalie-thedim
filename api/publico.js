// Rotas públicas: ?acao=enviar | aprovados | reagir
import { db, TABELAS, novoId, responder, lerBody, ipHash } from './_lib.js';

const JANELA_S = 600;
const MAX_ENVIOS = 5;

export default async function handler(req, res) {
  try {
    const acao = req.query.acao;

    if (acao === 'aprovados' && req.method === 'GET') {
      const tabela = req.query.tabela;
      if (!TABELAS[tabela]) return responder(res, 400, { erro: 'tabela inválida' });
      const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 20, 1), 100);
      const r = await db().execute({
        sql: `SELECT * FROM ${tabela} WHERE status = 'aprovado' ORDER BY criado_em DESC LIMIT ?`,
        args: [limite],
      });
      return responder(res, 200, { dados: r.rows });
    }

    if (req.method !== 'POST') return responder(res, 405, { erro: 'método não permitido' });
    const body = lerBody(req);

    if (acao === 'enviar') {
      const cfg = TABELAS[body.tabela];
      if (!cfg) return responder(res, 400, { erro: 'tabela inválida' });
      const dados = body.dados || {};
      const texto = String(dados.texto ?? '').trim();
      if (texto.length < cfg.min || texto.length > cfg.max) {
        return responder(res, 400, { erro: `O texto precisa ter entre ${cfg.min} e ${cfg.max} caracteres.` });
      }
      const colunas = ['id', 'texto'];
      const valores = [novoId(), texto];
      for (const c of cfg.extra) {
        const v = String(dados[c] ?? '').trim().slice(0, 60);
        if (v) { colunas.push(c); valores.push(v); }
      }
      const h = ipHash(req);
      const agora = Math.floor(Date.now() / 1000);
      const cont = await db().execute({
        sql: 'SELECT COUNT(*) AS n FROM limite_envios WHERE ip_hash = ? AND criado_em > ?',
        args: [h, agora - JANELA_S],
      });
      if (Number(cont.rows[0].n) >= MAX_ENVIOS) {
        return responder(res, 429, { erro: 'Muitos envios em pouco tempo. Tente novamente em alguns minutos.' });
      }
      await db().batch([
        { sql: `INSERT INTO ${body.tabela} (${colunas.join(',')}) VALUES (${colunas.map(() => '?').join(',')})`, args: valores },
        { sql: 'INSERT INTO limite_envios (ip_hash, criado_em) VALUES (?, ?)', args: [h, agora] },
        { sql: 'DELETE FROM limite_envios WHERE criado_em < ?', args: [agora - 86400] },
      ], 'write');
      return responder(res, 201, { ok: true });
    }

    if (acao === 'reagir') {
      const id = String(body.id || '');
      const r = await db().execute({
        sql: "UPDATE diario_posts SET reacoes = reacoes + 1 WHERE id = ? AND status = 'aprovado'",
        args: [id],
      });
      return responder(res, r.rowsAffected ? 200 : 404, { ok: r.rowsAffected > 0 });
    }

    return responder(res, 400, { erro: 'ação inválida' });
  } catch (e) {
    console.error('[publico]', e);
    return responder(res, 500, { erro: 'erro interno' });
  }
}

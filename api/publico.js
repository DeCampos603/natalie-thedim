// Rotas públicas: ?acao=enviar | aprovados | reagir
import { db, TABELAS, novoId, responder, lerBody, ipHash } from './_lib.js';

const JANELA_S = 600;
const MAX_ENVIOS = 5;
const agoraSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export default async function handler(req, res) {
  try {
    const acao = req.query.acao;

    if (acao === 'aprovados' && req.method === 'GET') {
      const tabela = req.query.tabela;
      if (!TABELAS[tabela]) return responder(res, 400, { erro: 'tabela inválida' });
      const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 20, 1), 100);
      const r = await db().execute(`SELECT * FROM ${tabela} WHERE status = 'aprovado' ORDER BY criado_em DESC LIMIT ${limite}`);
      return responder(res, 200, { dados: r.rows });
    }

    if (acao === 'biblioteca_temas' && req.method === 'GET') {
      const r = await db().execute('SELECT * FROM biblioteca_temas ORDER BY ordem ASC, titulo ASC');
      return responder(res, 200, { ok: true, dados: r.rows });
    }

    if (acao === 'filmes' && req.method === 'GET') {
      const r = await db().execute('SELECT * FROM filmes ORDER BY ordem ASC, criado_em DESC');
      return responder(res, 200, { ok: true, dados: r.rows });
    }

    if (acao === 'livros' && req.method === 'GET') {
      const r = await db().execute('SELECT * FROM livros ORDER BY ordem ASC, criado_em DESC');
      return responder(res, 200, { ok: true, dados: r.rows });
    }

    if (req.method !== 'POST') return responder(res, 405, { erro: 'método não permitido' });
    const body = lerBody(req);

    if (acao === 'newsletter') {
      const h = ipHash(req);
      const agora = Math.floor(Date.now() / 1000);
      const cont = await db().execute({
        sql: 'SELECT COUNT(*) AS n FROM limite_envios WHERE ip_hash = ? AND criado_em > ?',
        args: [h, agora - JANELA_S],
      });
      if (Number(cont.rows[0].n) >= MAX_ENVIOS) {
        return responder(res, 429, { erro: 'Muitas tentativas em pouco tempo. Tente novamente em alguns minutos.' });
      }

      const email = String(body.email || '').trim().toLowerCase();
      const nome = String(body.nome || '').trim().slice(0, 100);
      if (!email || !email.includes('@') || email.length < 5) {
        return responder(res, 400, { erro: 'E-mail inválido.' });
      }
      const id = novoId();
      await db().batch([
        {
          sql: `INSERT INTO newsletter_inscritos (id, email, nome, origem, criado_em)
                VALUES (?, ?, ?, 'site', ?)
                ON CONFLICT(email) DO UPDATE SET nome = excluded.nome`,
          args: [id, email, nome || null, agoraSql()],
        },
        { sql: 'INSERT INTO limite_envios (ip_hash, criado_em) VALUES (?, ?)', args: [h, agora] }
      ], 'write');
      return responder(res, 201, { ok: true, mensagem: 'Inscrição confirmada com sucesso!' });
    }

    if (acao === 'biblioteca_mensagem') {
      const h = ipHash(req);
      const agora = Math.floor(Date.now() / 1000);
      const cont = await db().execute({
        sql: 'SELECT COUNT(*) AS n FROM limite_envios WHERE ip_hash = ? AND criado_em > ?',
        args: [h, agora - JANELA_S],
      });
      if (Number(cont.rows[0].n) >= MAX_ENVIOS) {
        return responder(res, 429, { erro: 'Muitas mensagens em pouco tempo. Tente novamente em alguns minutos.' });
      }

      const tema_chave = String(body.tema_chave || '').trim().slice(0, 60);
      const mensagem = String(body.mensagem || '').trim();
      const nome = String(body.nome || '').trim().slice(0, 100);
      const email = String(body.email || '').trim().slice(0, 120);
      const whatsapp = String(body.whatsapp || '').trim().slice(0, 30);

      if (!tema_chave || mensagem.length < 5) {
        return responder(res, 400, { erro: 'Tema e mensagem com pelo menos 5 caracteres são obrigatórios.' });
      }

      const id = novoId();
      await db().batch([
        {
          sql: `INSERT INTO biblioteca_mensagens (id, tema_chave, nome, email, whatsapp, mensagem, criado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [id, tema_chave, nome || 'Anônimo', email || null, whatsapp || null, mensagem, agoraSql()],
        },
        { sql: 'INSERT INTO limite_envios (ip_hash, criado_em) VALUES (?, ?)', args: [h, agora] }
      ], 'write');
      return responder(res, 201, { ok: true, mensagem: 'Mensagem sobre o tema registrada com sucesso!' });
    }

    if (acao === 'enviar') {
      const cfg = TABELAS[body.tabela];
      if (!cfg) return responder(res, 400, { erro: 'tabela inválida' });
      const dados = body.dados || {};
      const texto = String(dados.texto ?? '').trim();
      if (texto.length < cfg.min || texto.length > cfg.max) {
        return responder(res, 400, { erro: `O texto precisa ter entre ${cfg.min} e ${cfg.max} caracteres.` });
      }
      const colunas = ['id', 'texto', 'criado_em'];
      const valores = [novoId(), texto, agoraSql()];
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

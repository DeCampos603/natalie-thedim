// Rotas da Natalie: ?acao=entrar | sair | sessao | listar | moderar
import { db, TABELAS, STATUS, responder, lerBody, criarSessao, sessaoValida, iguais, cookieSessao, ipHash } from './_lib.js';

const falhas = new Map(); // por instância; freio simples contra tentativa em massa

export default async function handler(req, res) {
  try {
    const acao = req.query.acao;

    if (acao === 'sessao') return responder(res, 200, { ativa: await sessaoValida(req) });

    if (acao === 'entrar' && req.method === 'POST') {
      const h = ipHash(req);
      const f = falhas.get(h) || { n: 0, ate: 0 };
      if (f.n >= 5 && Date.now() < f.ate) return responder(res, 429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
      const { email, senha } = lerBody(req);
      const configurado = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_EMAIL);
      const okEmail = iguais(String(email || '').trim().toLowerCase(), String(process.env.ADMIN_EMAIL || '').toLowerCase());
      const okSenha = iguais(senha || '', process.env.ADMIN_PASSWORD || '');
      if (!configurado || !okEmail || !okSenha) {
        falhas.set(h, { n: f.n + 1, ate: Date.now() + 15 * 60 * 1000 });
        return responder(res, 401, { erro: 'E-mail ou senha incorretos.' });
      }
      falhas.delete(h);
      res.setHeader('Set-Cookie', cookieSessao(await criarSessao(), 8 * 3600));
      return responder(res, 200, { ok: true });
    }

    if (acao === 'sair') {
      res.setHeader('Set-Cookie', cookieSessao('', 0));
      return responder(res, 200, { ok: true });
    }

    if (!(await sessaoValida(req))) return responder(res, 401, { erro: 'não autenticado' });

    if (acao === 'listar' && req.method === 'GET') {
      const tabela = req.query.tabela;
      if (!TABELAS[tabela]) return responder(res, 400, { erro: 'tabela inválida' });
      const r = await db().execute(`SELECT * FROM ${tabela} ORDER BY criado_em DESC`);
      return responder(res, 200, { dados: r.rows });
    }

    if (acao === 'moderar' && req.method === 'POST') {
      const { tabela, id, status, extra = {} } = lerBody(req);
      if (!TABELAS[tabela] || !STATUS.includes(status)) return responder(res, 400, { erro: 'parâmetros inválidos' });
      const carimbo = tabela === 'perguntas' ? 'respondida_em' : 'moderado_em';
      const sets = ['status = ?', `${carimbo} = ?`];
      const args = [status, new Date().toISOString()];
      for (const c of ['resposta_tipo', 'resposta_texto', 'resposta_url']) {
        if (typeof extra[c] === 'string' && extra[c].trim() && tabela !== 'diario_posts') {
          sets.push(`${c} = ?`); args.push(extra[c].trim().slice(0, 4000));
        }
      }
      args.push(String(id));
      const r = await db().execute({ sql: `UPDATE ${tabela} SET ${sets.join(', ')} WHERE id = ?`, args });
      return responder(res, r.rowsAffected ? 200 : 404, { ok: r.rowsAffected > 0 });
    }

    return responder(res, 400, { erro: 'ação inválida' });
  } catch (e) {
    console.error('[admin]', e);
    return responder(res, 500, { erro: 'erro interno' });
  }
}

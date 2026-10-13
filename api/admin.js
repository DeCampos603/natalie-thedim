// Rotas da Natalie: ?acao=entrar | sair | sessao | listar | moderar
import { db, TABELAS, STATUS, responder, lerBody, criarSessao, sessaoValida, iguais, cookieSessao, ipHash } from './_lib.js';

const falhas = new Map(); // por instância; freio simples contra tentativa em massa

export default async function handler(req, res) {
  try {
    const urlObj = req.url ? new URL(req.url, 'http://localhost') : null;
    const acao = req.query?.acao || urlObj?.searchParams.get('acao') || req.body?.acao;

    if (acao === 'sessao') return responder(res, 200, { ativa: await sessaoValida(req) });

    if (acao === 'entrar' && req.method === 'POST') {
      const h = ipHash(req);
      const f = falhas.get(h) || { n: 0, ate: 0 };
      if (f.n >= 5 && Date.now() < f.ate) return responder(res, 429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' });
      
      const { email, usuario, senha } = lerBody(req);
      const loginInformado = String(usuario || email || '').trim();
      const senhaInformada = String(senha || '');

      const userConfigurado = process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL;
      const senhaConfigurada = process.env.ADMIN_PASSWORD;

      if (!userConfigurado || !senhaConfigurada) {
        return responder(res, 500, { erro: 'Variáveis ADMIN_USERNAME ou ADMIN_PASSWORD não configuradas no ambiente.' });
      }

      const okUser = iguais(loginInformado.toLowerCase(), String(userConfigurado).trim().toLowerCase());
      const okSenha = iguais(senhaInformada, String(senhaConfigurada));

      if (!okUser || !okSenha) {
        falhas.set(h, { n: f.n + 1, ate: Date.now() + 15 * 60 * 1000 });
        return responder(res, 401, { erro: 'Usuário ou senha incorretos.' });
      }

      falhas.delete(h);
      const token = await criarSessao({ sub: userConfigurado });
      res.setHeader('Set-Cookie', cookieSessao(token, 8 * 3600));
      return responder(res, 200, { ok: true, token });
    }

    if (acao === 'sair') {
      res.setHeader('Set-Cookie', cookieSessao('', 0));
      return responder(res, 200, { ok: true });
    }

    if (!(await sessaoValida(req))) return responder(res, 401, { erro: 'não autenticado' });

    // === Mini-CMS: Conteúdo Dinâmico (site_content) ===
    if (acao === 'obter_conteudo' && req.method === 'GET') {
      const r = await db().execute('SELECT id, section_name, content_text, image_url, updated_at FROM site_content ORDER BY section_name ASC');
      return responder(res, 200, { ok: true, dados: r.rows });
    }

    if (acao === 'salvar_conteudo' && req.method === 'POST') {
      const { secoes } = lerBody(req);
      if (!secoes || typeof secoes !== 'object') {
        return responder(res, 400, { erro: 'Estrutura de dados inválida.' });
      }

      const agora = new Date().toISOString();
      const statements = [];

      // Pode receber array de objetos [{ section_name, content_text, image_url }] ou objeto chave-valor
      if (Array.isArray(secoes)) {
        for (const item of secoes) {
          if (!item.section_name) continue;
          statements.push({
            sql: `INSERT INTO site_content (id, section_name, content_text, image_url, updated_at)
                  VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(section_name) DO UPDATE SET
                    content_text = excluded.content_text,
                    image_url = excluded.image_url,
                    updated_at = excluded.updated_at`,
            args: [
              item.id || `sec_${item.section_name}`,
              String(item.section_name).trim(),
              String(item.content_text ?? '').trim(),
              item.image_url ? String(item.image_url).trim() : null,
              agora
            ]
          });
        }
      } else {
        for (const [chave, valor] of Object.entries(secoes)) {
          const texto = typeof valor === 'object' && valor !== null ? (valor.content_text ?? valor.texto) : valor;
          const imagem = typeof valor === 'object' && valor !== null ? valor.image_url : null;
          statements.push({
            sql: `INSERT INTO site_content (id, section_name, content_text, image_url, updated_at)
                  VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(section_name) DO UPDATE SET
                    content_text = excluded.content_text,
                    image_url = coalesce(excluded.image_url, site_content.image_url),
                    updated_at = excluded.updated_at`,
            args: [`sec_${chave}`, chave, String(texto ?? '').trim(), imagem, agora]
          });
        }
      }

      if (statements.length > 0) {
        await db().batch(statements, 'write');
      }

      return responder(res, 200, { ok: true, mensagem: 'Conteúdo atualizado com sucesso.' });
    }

    // === Moderação de Histórias, Cartas, Perguntas e Diário ===
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

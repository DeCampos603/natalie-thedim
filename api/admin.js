// Rotas da Natalie: ?acao=entrar | sair | sessao | listar | moderar | publicar_item
import { db, TABELAS, STATUS, responder, lerBody, criarSessao, sessaoValida, iguais, cookieSessao, ipHash, novoId } from './_lib.js';

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

      const userConfigurado = process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL || 'natalie';
      const emailConfigurado = process.env.ADMIN_EMAIL || 'natalie@admin.local';
      const senhaConfigurada = process.env.ADMIN_PASSWORD;

      if (!senhaConfigurada) {
        return responder(res, 500, { erro: 'Variável ADMIN_PASSWORD não configurada no ambiente.' });
      }

      const loginLower = loginInformado.toLowerCase();
      const okUser =
        iguais(loginLower, String(userConfigurado).trim().toLowerCase()) ||
        iguais(loginLower, String(emailConfigurado).trim().toLowerCase()) ||
        iguais(loginLower, 'natalie') ||
        iguais(loginLower, 'natalie@admin.local') ||
        iguais(loginLower, 'psicologa.nataliethedim@gmail.com');
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

    if (acao === 'publicar_item' && req.method === 'POST') {
      const body = lerBody(req);
      const tabela = String(body.tabela || '').trim();
      if (!['historias', 'cartas', 'perguntas', 'diario_posts'].includes(tabela)) {
        return responder(res, 400, { erro: 'Tabela inválida para publicação.' });
      }
      const cfg = TABELAS[tabela];
      const texto = String(body.texto ?? '').trim();
      if (texto.length < cfg.min || texto.length > cfg.max) {
        return responder(res, 400, { erro: `O texto precisa ter entre ${cfg.min} e ${cfg.max} caracteres.` });
      }

      const statusFinal = body.status === 'pendente' ? 'pendente' : 'aprovado';
      const agora = new Date().toISOString();
      const id = novoId();
      const colunas = ['id', 'texto', 'status', 'criado_em'];
      const valores = [id, texto, statusFinal, agora];

      if (statusFinal === 'aprovado') {
        const carimbo = tabela === 'perguntas' ? 'respondida_em' : 'moderado_em';
        colunas.push(carimbo);
        valores.push(agora);
      }

      if (tabela === 'cartas') {
        const destinatario = String(body.destinatario ?? '').trim().slice(0, 60);
        if (destinatario) {
          colunas.push('destinatario');
          valores.push(destinatario);
        }
      }

      const respostaTexto = String(body.resposta_texto ?? '').trim().slice(0, 4000);
      if (respostaTexto && tabela !== 'diario_posts') {
        colunas.push('resposta_tipo', 'resposta_texto');
        valores.push('texto', respostaTexto);
      }

      await db().execute({
        sql: `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`,
        args: valores
      });

      return responder(res, 201, { ok: true, id, status: statusFinal });
    }

    // === Gestão de Newsletter ===
    if (acao === 'newsletter_listar' && req.method === 'GET') {
      const r = await db().execute('SELECT id, email, nome, origem, criado_em FROM newsletter_inscritos ORDER BY criado_em DESC');
      return responder(res, 200, { ok: true, dados: r.rows });
    }
    if (acao === 'newsletter_remover' && req.method === 'POST') {
      const { id } = lerBody(req);
      await db().execute({ sql: 'DELETE FROM newsletter_inscritos WHERE id = ?', args: [String(id)] });
      return responder(res, 200, { ok: true });
    }

    // === Gestão da Biblioteca (Temas e Histórico de Mensagens) ===
    if (acao === 'biblioteca_listar_temas' && req.method === 'GET') {
      const r = await db().execute(`
        SELECT t.*, 
          (SELECT COUNT(*) FROM biblioteca_mensagens m WHERE m.tema_chave = t.tema_chave) AS total_mensagens
        FROM biblioteca_temas t
        ORDER BY t.ordem ASC, t.titulo ASC
      `);
      return responder(res, 200, { ok: true, dados: r.rows });
    }
    if (acao === 'biblioteca_salvar_tema' && req.method === 'POST') {
      const { id, tema_chave, pilar, titulo, texto, perguntas, ordem } = lerBody(req);
      const temaId = id || `tema_${tema_chave || Date.now()}`;
      await db().execute({
        sql: `INSERT INTO biblioteca_temas (id, tema_chave, pilar, titulo, texto, perguntas, ordem, atualizado_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(tema_chave) DO UPDATE SET
                pilar = excluded.pilar,
                titulo = excluded.titulo,
                texto = excluded.texto,
                perguntas = excluded.perguntas,
                ordem = excluded.ordem,
                atualizado_em = datetime('now')`,
        args: [temaId, tema_chave, pilar || 'Casamento e Relacionamentos', titulo, texto, perguntas, Number(ordem) || 0]
      });
      return responder(res, 200, { ok: true, mensagem: 'Tema da biblioteca salvo com sucesso.' });
    }
    if (acao === 'biblioteca_excluir_tema' && req.method === 'POST') {
      const { tema_chave } = lerBody(req);
      await db().execute({ sql: 'DELETE FROM biblioteca_temas WHERE tema_chave = ?', args: [String(tema_chave)] });
      return responder(res, 200, { ok: true });
    }
    if (acao === 'biblioteca_historico' && req.method === 'GET') {
      const tema = req.query.tema_chave;
      const sql = tema 
        ? 'SELECT * FROM biblioteca_mensagens WHERE tema_chave = ? ORDER BY criado_em DESC'
        : 'SELECT * FROM biblioteca_mensagens ORDER BY criado_em DESC';
      const args = tema ? [tema] : [];
      const r = await db().execute({ sql, args });
      return responder(res, 200, { ok: true, dados: r.rows });
    }

    // === Gestão de Filmes (Clube do Filme) ===
    if (acao === 'filmes_listar' && req.method === 'GET') {
      const r = await db().execute('SELECT * FROM filmes ORDER BY ordem ASC, criado_em DESC');
      return responder(res, 200, { ok: true, dados: r.rows });
    }
    if (acao === 'filmes_salvar' && req.method === 'POST') {
      const { id, titulo, direcao_ano, badge, sinopse, perguntas, reflexao, ordem } = lerBody(req);
      const filmeId = id || `filme_${Date.now()}`;
      const criadoEm = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await db().execute({
        sql: `INSERT INTO filmes (id, titulo, direcao_ano, badge, sinopse, perguntas, reflexao, ordem, criado_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                titulo = excluded.titulo,
                direcao_ano = excluded.direcao_ano,
                badge = excluded.badge,
                sinopse = excluded.sinopse,
                perguntas = excluded.perguntas,
                reflexao = excluded.reflexao,
                ordem = excluded.ordem`,
        args: [filmeId, titulo, direcao_ano || '', badge || 'Cinema & Clínica', sinopse, perguntas || '', reflexao || '', Number(ordem) || 0, criadoEm]
      });
      return responder(res, 200, { ok: true, mensagem: 'Filme salvo com sucesso.' });
    }
    if (acao === 'filmes_excluir' && req.method === 'POST') {
      const { id } = lerBody(req);
      await db().execute({ sql: 'DELETE FROM filmes WHERE id = ?', args: [String(id)] });
      return responder(res, 200, { ok: true });
    }

    // === Gestão de Livros (Clube do Livro) ===
    if (acao === 'livros_listar' && req.method === 'GET') {
      const r = await db().execute('SELECT * FROM livros ORDER BY ordem ASC, criado_em DESC');
      return responder(res, 200, { ok: true, dados: r.rows });
    }
    if (acao === 'livros_salvar' && req.method === 'POST') {
      const { id, titulo, autor_ano, badge, sinopse, licao, citacao, ordem } = lerBody(req);
      const livroId = id || `livro_${Date.now()}`;
      const criadoEm = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await db().execute({
        sql: `INSERT INTO livros (id, titulo, autor_ano, badge, sinopse, licao, citacao, ordem, criado_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                titulo = excluded.titulo,
                autor_ano = excluded.autor_ano,
                badge = excluded.badge,
                sinopse = excluded.sinopse,
                licao = excluded.licao,
                citacao = excluded.citacao,
                ordem = excluded.ordem`,
        args: [livroId, titulo, autor_ano || '', badge || 'Leitura Sistêmica', sinopse, licao || '', citacao || '', Number(ordem) || 0, criadoEm]
      });
      return responder(res, 200, { ok: true, mensagem: 'Livro salvo com sucesso.' });
    }
    if (acao === 'livros_excluir' && req.method === 'POST') {
      const { id } = lerBody(req);
      await db().execute({ sql: 'DELETE FROM livros WHERE id = ?', args: [String(id)] });
      return responder(res, 200, { ok: true });
    }

    return responder(res, 400, { erro: 'ação inválida' });
  } catch (e) {
    console.error('[admin]', e);
    return responder(res, 500, { erro: 'erro interno' });
  }
}

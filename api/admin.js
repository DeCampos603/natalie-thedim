// Rotas da Natalie: ?acao=entrar | sair | sessao | listar | moderar | publicar_item | ...
import {
  db, TABELAS, STATUS, responder, lerBody, criarSessao, sessaoValida, iguais,
  cookieSessao, ipHash, novoId, agoraSql, slugify, safeHttpUrl,
  mapTemaBiblioteca, mapFilme, mapLivro
} from './_lib.js';

const falhas = new Map(); // por instância; freio simples contra tentativa em massa

export default async function handler(req, res) {
  try {
    if (typeof res.setHeader === 'function') res.setHeader('Cache-Control', 'no-store');
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
      res.setHeader('Set-Cookie', cookieSessao(token, 8 * 3600, req));
      return responder(res, 200, { ok: true, token });
    }

    if (acao === 'sair') {
      res.setHeader('Set-Cookie', cookieSessao('', 0, req));
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

      const agora = agoraSql();
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
                    image_url = coalesce(excluded.image_url, site_content.image_url),
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
          if (['acao', 'token'].includes(chave)) continue;
          const texto = typeof valor === 'object' && valor !== null ? (valor.content_text ?? valor.texto) : valor;
          const imagem = typeof valor === 'object' && valor !== null ? (valor.image_url ?? valor.imagem) : null;
          statements.push({
            sql: `INSERT INTO site_content (id, section_name, content_text, image_url, updated_at)
                  VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(section_name) DO UPDATE SET
                    content_text = excluded.content_text,
                    image_url = coalesce(excluded.image_url, site_content.image_url),
                    updated_at = excluded.updated_at`,
            args: [`sec_${chave}`, chave, String(texto ?? '').trim(), imagem ? String(imagem).trim() : null, agora]
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
      const args = [status, agoraSql()];
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
      const agora = agoraSql();
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
      if (!id) return responder(res, 400, { ok: false, erro: 'ID obrigatório.' });
      const r = await db().execute({ sql: 'DELETE FROM newsletter_inscritos WHERE id = ?', args: [String(id)] });
      return responder(res, r.rowsAffected ? 200 : 404, { ok: r.rowsAffected > 0, erro: r.rowsAffected ? undefined : 'Inscrito não encontrado.' });
    }

    // === Gestão da Biblioteca (Temas e Histórico de Mensagens) ===
    if (acao === 'biblioteca_listar_temas' && req.method === 'GET') {
      const r = await db().execute(`
        SELECT t.*, 
          (SELECT COUNT(*) FROM biblioteca_mensagens m WHERE m.tema_chave = t.tema_chave OR m.tema_chave = t.id) AS total_mensagens
        FROM biblioteca_temas t
        ORDER BY t.ordem ASC, t.titulo ASC
      `);
      return responder(res, 200, { ok: true, dados: r.rows.map(mapTemaBiblioteca) });
    }
    if (acao === 'biblioteca_salvar_tema' && req.method === 'POST') {
      const body = lerBody(req);
      const rawId = String(body.id || '').trim();
      const titulo = String(body.titulo || '').trim().slice(0, 255);
      const pilar = String(body.pilar || body.categoria || 'Casamento e Relacionamentos').trim().slice(0, 100);
      const texto = String(body.texto ?? body.conteudo ?? body.resumo ?? '').trim();
      const resumo = String(body.resumo ?? '').trim().slice(0, 1000);
      const icone = String(body.icone ?? '💬').trim().slice(0, 20) || '💬';
      const perguntas = String(body.perguntas || '[]').trim();
      const ordem = Number(body.ordem) || 0;

      if (!titulo || !texto) {
        return responder(res, 400, { ok: false, erro: 'Título e conteúdo do tema são obrigatórios.' });
      }

      let temaChave = slugify(body.tema_chave || '');
      if (!temaChave && rawId) {
        const existe = await db().execute({
          sql: 'SELECT tema_chave FROM biblioteca_temas WHERE id = ? LIMIT 1',
          args: [rawId]
        });
        temaChave = existe.rows?.[0]?.tema_chave || slugify(rawId) || rawId;
      }
      if (!temaChave) {
        temaChave = slugify(titulo) || `tema_${Date.now()}`;
      }
      const temaId = rawId || `tema_${temaChave}`;
      const atualizadoEm = agoraSql();

      await db().execute({
        sql: `INSERT INTO biblioteca_temas (id, tema_chave, pilar, titulo, texto, perguntas, icone, resumo, ordem, atualizado_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(tema_chave) DO UPDATE SET
                pilar = excluded.pilar,
                titulo = excluded.titulo,
                texto = excluded.texto,
                perguntas = excluded.perguntas,
                icone = excluded.icone,
                resumo = excluded.resumo,
                ordem = excluded.ordem,
                atualizado_em = excluded.atualizado_em`,
        args: [temaId, temaChave, pilar, titulo, texto, perguntas, icone, resumo || null, ordem, atualizadoEm]
      });
      return responder(res, 200, { ok: true, id: temaId, tema_chave: temaChave, mensagem: 'Tema da biblioteca salvo com sucesso.' });
    }
    if (acao === 'biblioteca_excluir_tema' && req.method === 'POST') {
      const body = lerBody(req);
      const chaveOuId = String(body.id || body.tema_chave || '').trim();
      if (!chaveOuId) return responder(res, 400, { ok: false, erro: 'ID ou chave do tema é obrigatório.' });
      const r = await db().execute({
        sql: 'DELETE FROM biblioteca_temas WHERE id = ? OR tema_chave = ?',
        args: [chaveOuId, chaveOuId]
      });
      return responder(res, r.rowsAffected ? 200 : 404, { ok: r.rowsAffected > 0, erro: r.rowsAffected ? undefined : 'Tema não encontrado.' });
    }
    if (acao === 'biblioteca_historico' && req.method === 'GET') {
      const filtro = String(req.query.tema || req.query.tema_chave || '').trim();
      const baseSql = `
        SELECT m.*, t.titulo AS tema_titulo_join
        FROM biblioteca_mensagens m
        LEFT JOIN biblioteca_temas t ON (m.tema_chave = t.tema_chave OR m.tema_chave = t.id)
      `;
      const sql = filtro
        ? `${baseSql} WHERE m.tema_chave = ? OR t.id = ? OR t.tema_chave = ? ORDER BY m.criado_em DESC`
        : `${baseSql} ORDER BY m.criado_em DESC`;
      const args = filtro ? [filtro, filtro, filtro] : [];
      const r = await db().execute({ sql, args });
      const dados = r.rows.map((row) => ({
        ...row,
        tema_titulo: row.tema_titulo_join || (row.tema_chave === 'supervisao_terapeutas' ? 'Supervisão Clínica (Terapeutas)' : row.tema_chave),
        nome_remetente: row.nome || 'Anônimo',
        email_remetente: row.email || ''
      }));
      return responder(res, 200, { ok: true, dados });
    }

    // === Gestão de Filmes (Clube do Filme) ===
    if (acao === 'filmes_listar' && req.method === 'GET') {
      const r = await db().execute('SELECT * FROM filmes ORDER BY ordem ASC, criado_em DESC');
      return responder(res, 200, { ok: true, dados: r.rows.map(mapFilme) });
    }
    if (acao === 'filmes_salvar' && req.method === 'POST') {
      const body = lerBody(req);
      const filmeId = String(body.id || '').trim() || `filme_${Date.now()}`;
      const titulo = String(body.titulo || '').trim().slice(0, 255);
      const diretor = String(body.diretor || '').trim().slice(0, 80);
      const ano = String(body.ano || '').trim().slice(0, 12);
      const direcaoAno = String(body.direcao_ano || '').trim().slice(0, 100) || [diretor, ano].filter(Boolean).join(' · ');
      const badge = String(body.badge || body.categoria || 'Curadoria Clínica').trim().slice(0, 100);
      const sinopse = String(body.sinopse || '').trim();
      const linkSeguro = safeHttpUrl(body.link);
      const perguntas = body.perguntas !== undefined
        ? String(body.perguntas || '').trim()
        : (linkSeguro ? JSON.stringify({ link: linkSeguro }) : '[]');
      const reflexao = String(body.reflexao || '').trim();
      const ordem = Number(body.ordem) || 0;

      if (!titulo || !sinopse) {
        return responder(res, 400, { ok: false, erro: 'Título e sinopse do filme são obrigatórios.' });
      }

      const criadoEm = agoraSql();
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
        args: [filmeId, titulo, direcaoAno, badge, sinopse, perguntas, reflexao, ordem, criadoEm]
      });
      return responder(res, 200, { ok: true, id: filmeId, mensagem: 'Filme salvo com sucesso.' });
    }
    if (acao === 'filmes_excluir' && req.method === 'POST') {
      const { id } = lerBody(req);
      if (!id) return responder(res, 400, { ok: false, erro: 'ID obrigatório.' });
      const r = await db().execute({ sql: 'DELETE FROM filmes WHERE id = ?', args: [String(id)] });
      return responder(res, r.rowsAffected ? 200 : 404, { ok: r.rowsAffected > 0, erro: r.rowsAffected ? undefined : 'Filme não encontrado.' });
    }

    // === Gestão de Livros (Clube do Livro) ===
    if (acao === 'livros_listar' && req.method === 'GET') {
      const r = await db().execute('SELECT * FROM livros ORDER BY ordem ASC, criado_em DESC');
      return responder(res, 200, { ok: true, dados: r.rows.map(mapLivro) });
    }
    if (acao === 'livros_salvar' && req.method === 'POST') {
      const body = lerBody(req);
      const livroId = String(body.id || '').trim() || `livro_${Date.now()}`;
      const titulo = String(body.titulo || '').trim().slice(0, 255);
      const autorAno = String(body.autor_ano || body.autor || '').trim().slice(0, 100);
      const badge = String(body.badge || body.categoria || 'Biblioterapia').trim().slice(0, 100);
      const licao = String(body.licao ?? body.analise ?? '').trim();
      const citacao = String(body.citacao || '').trim();
      const linkSeguro = safeHttpUrl(body.link);
      let sinopse = String(body.sinopse || '').trim();
      if (!sinopse && linkSeguro) {
        sinopse = JSON.stringify({ link: linkSeguro });
      }
      const ordem = Number(body.ordem) || 0;

      if (!titulo || (!licao && !sinopse && !citacao)) {
        return responder(res, 400, { ok: false, erro: 'Título e análise ou citação do livro são obrigatórios.' });
      }

      const criadoEm = agoraSql();
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
        args: [livroId, titulo, autorAno, badge, sinopse, licao, citacao, ordem, criadoEm]
      });
      return responder(res, 200, { ok: true, id: livroId, mensagem: 'Livro salvo com sucesso.' });
    }
    if (acao === 'livros_excluir' && req.method === 'POST') {
      const { id } = lerBody(req);
      if (!id) return responder(res, 400, { ok: false, erro: 'ID obrigatório.' });
      const r = await db().execute({ sql: 'DELETE FROM livros WHERE id = ?', args: [String(id)] });
      return responder(res, r.rowsAffected ? 200 : 404, { ok: r.rowsAffected > 0, erro: r.rowsAffected ? undefined : 'Livro não encontrado.' });
    }

    return responder(res, 400, { erro: 'ação inválida' });
  } catch (e) {
    console.error('[admin]', e);
    return responder(res, 500, { erro: 'erro interno' });
  }
}

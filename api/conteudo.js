// Rota RESTful de Conteúdo: /api/conteudo
// GET (Pública): Carrega os dados dinâmicos do Turso para hidratar o site principal.
// PUT / POST (Protegida): Atualiza seções no Turso mediante autenticação de administrador.

import { db, responder, lerBody, sessaoValida } from './_lib.js';

export default async function handler(req, res) {
  try {
    // -------------------------------------------------------------
    // 1. ROTA GET (PÚBLICA) — ALIMENTA O SITE PRINCIPAL
    // -------------------------------------------------------------
    if (req.method === 'GET') {
      const r = await db().execute(
        'SELECT id, section_name, content_text, image_url, updated_at FROM site_content ORDER BY section_name ASC'
      );

      const mapa = {};
      for (const row of r.rows) {
        mapa[row.section_name] = {
          texto: row.content_text,
          imagem: row.image_url,
          atualizado_em: row.updated_at,
        };
      }

      // Permite cache de 60 segundos com revalidação em segundo plano na CDN da Vercel
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return responder(res, 200, {
        ok: true,
        conteudo: mapa,
        itens: r.rows,
      });
    }

    // -------------------------------------------------------------
    // 2. ROTA PUT / POST (PROTEGIDA) — ATUALIZAÇÃO NO TURSO
    // -------------------------------------------------------------
    if (req.method === 'PUT' || req.method === 'POST') {
      const autenticado = await sessaoValida(req);
      if (!autenticado) {
        return responder(res, 401, {
          ok: false,
          erro: 'Acesso não autorizado. Sessão inválida ou expirada.',
        });
      }

      const body = lerBody(req);
      const secoes = body.secoes || body;

      if (!secoes || typeof secoes !== 'object') {
        return responder(res, 400, {
          ok: false,
          erro: 'Payload inválido. Esperado objeto ou array de seções.',
        });
      }

      const agora = new Date().toISOString();
      const statements = [];

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
              agora,
            ],
          });
        }
      } else {
        for (const [chave, valor] of Object.entries(secoes)) {
          // Ignora propriedades de controle se vierem no corpo
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
            args: [
              `sec_${chave}`,
              String(chave).trim(),
              String(texto ?? '').trim(),
              imagem ? String(imagem).trim() : null,
              agora,
            ],
          });
        }
      }

      if (statements.length === 0) {
        return responder(res, 400, { ok: false, erro: 'Nenhuma seção válida fornecida para atualização.' });
      }

      await db().batch(statements, 'write');

      return responder(res, 200, {
        ok: true,
        mensagem: 'Conteúdo atualizado com sucesso no banco Turso.',
        atualizado_em: agora,
        total_secoes: statements.length,
      });
    }

    return responder(res, 405, { ok: false, erro: 'Método não permitido. Utilize GET, PUT ou POST.' });
  } catch (error) {
    console.error('[/api/conteudo]', error);
    return responder(res, 500, {
      ok: false,
      erro: 'Erro interno ao processar requisição no banco Turso: ' + error.message,
    });
  }
}

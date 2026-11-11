// Rotas públicas: ?acao=enviar | aprovados | reagir | newsletter | biblioteca_temas | biblioteca_mensagem | filmes | livros | supervisao
import {
  db, TABELAS, novoId, responder, lerBody, ipHash, agoraSql, EMAIL_RE,
  checarLimite, mapTemaBiblioteca, mapFilme, mapLivro, slugify
} from './_lib.js';
import { enviarEmailNotificacao } from './notificar.js';

const JANELA_S = 600;
const MAX_ENVIOS = 5;
const reagirThrottle = new Map();

export default async function handler(req, res) {
  try {
    if (typeof res.setHeader === 'function') res.setHeader('Cache-Control', 'no-store');
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
      return responder(res, 200, { ok: true, dados: r.rows.map(mapTemaBiblioteca) });
    }

    if (acao === 'filmes' && req.method === 'GET') {
      const r = await db().execute('SELECT * FROM filmes ORDER BY ordem ASC, criado_em DESC');
      return responder(res, 200, { ok: true, dados: r.rows.map(mapFilme) });
    }

    if (acao === 'livros' && req.method === 'GET') {
      const r = await db().execute('SELECT * FROM livros ORDER BY ordem ASC, criado_em DESC');
      return responder(res, 200, { ok: true, dados: r.rows.map(mapLivro) });
    }

    if (req.method !== 'POST') return responder(res, 405, { erro: 'método não permitido' });
    const body = lerBody(req);

    if (acao === 'newsletter') {
      const lim = await checarLimite(req, JANELA_S, MAX_ENVIOS);
      if (lim.bloqueado) {
        return responder(res, 429, { ok: false, erro: 'Muitas tentativas em pouco tempo. Tente novamente em alguns minutos.' });
      }

      const email = String(body.email || '').trim().toLowerCase().slice(0, 190);
      const nome = String(body.nome || '').trim().slice(0, 100);
      const origem = String(body.origem || 'site').trim().slice(0, 50) || 'site';
      if (!EMAIL_RE.test(email)) {
        return responder(res, 400, { ok: false, erro: 'E-mail inválido.' });
      }
      const id = novoId();
      await db().batch([
        {
          sql: `INSERT INTO newsletter_inscritos (id, email, nome, origem, criado_em)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                  nome = COALESCE(NULLIF(excluded.nome, ''), newsletter_inscritos.nome),
                  origem = excluded.origem`,
          args: [id, email, nome || null, origem, agoraSql()],
        },
        { sql: 'INSERT INTO limite_envios (ip_hash, criado_em) VALUES (?, ?)', args: [lim.h, lim.agora] },
        { sql: 'DELETE FROM limite_envios WHERE criado_em < ?', args: [lim.agora - 86400] },
      ], 'write');
      return responder(res, 201, { ok: true, mensagem: 'Inscrição confirmada com sucesso!' });
    }

    if (acao === 'biblioteca_mensagem') {
      const lim = await checarLimite(req, JANELA_S, MAX_ENVIOS);
      if (lim.bloqueado) {
        return responder(res, 429, { ok: false, erro: 'Muitas mensagens em pouco tempo. Tente novamente em alguns minutos.' });
      }

      const rawTema = String(body.tema_chave || body.tema_id || '').trim().slice(0, 100);
      const mensagem = String(body.mensagem || '').trim().slice(0, 2000);
      const nome = String(body.nome || '').trim().slice(0, 100);
      const email = String(body.email || '').trim().toLowerCase().slice(0, 190);
      const whatsapp = String(body.whatsapp || '').trim().slice(0, 30);

      if (!rawTema || mensagem.length < 5) {
        return responder(res, 400, { ok: false, erro: 'Tema e mensagem com pelo menos 5 caracteres são obrigatórios.' });
      }
      if (email && !EMAIL_RE.test(email)) {
        return responder(res, 400, { ok: false, erro: 'E-mail informado é inválido.' });
      }

      let tema_chave = rawTema;
      const buscaTema = await db().execute({
        sql: 'SELECT tema_chave FROM biblioteca_temas WHERE tema_chave = ? OR id = ? LIMIT 1',
        args: [rawTema, rawTema]
      });
      if (buscaTema.rows?.[0]?.tema_chave) {
        tema_chave = buscaTema.rows[0].tema_chave;
      } else if (tema_chave.length > 60) {
        tema_chave = slugify(tema_chave) || tema_chave.slice(0, 60);
      }

      const id = novoId();
      await db().batch([
        {
          sql: `INSERT INTO biblioteca_mensagens (id, tema_chave, nome, email, whatsapp, mensagem, criado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [id, tema_chave, nome || 'Anônimo', email || null, whatsapp || null, mensagem, agoraSql()],
        },
        { sql: 'INSERT INTO limite_envios (ip_hash, criado_em) VALUES (?, ?)', args: [lim.h, lim.agora] },
        { sql: 'DELETE FROM limite_envios WHERE criado_em < ?', args: [lim.agora - 86400] },
      ], 'write');
      return responder(res, 201, { ok: true, mensagem: 'Mensagem sobre o tema registrada com sucesso!' });
    }

    if (acao === 'supervisao') {
      const lim = await checarLimite(req, JANELA_S, MAX_ENVIOS);
      if (lim.bloqueado) {
        return responder(res, 429, { ok: false, erro: 'Muitas solicitações em pouco tempo. Tente novamente em alguns minutos.' });
      }

      const nome = String(body.nome || '').trim().slice(0, 120);
      const crp = String(body.crp || '').trim().slice(0, 60);
      const tempo = String(body.tempo || '').trim().slice(0, 60);
      const whatsapp = String(body.whatsapp || '').trim().slice(0, 40);
      const email = String(body.email || '').trim().toLowerCase().slice(0, 190);
      const interesse = String(body.interesse || '').trim().slice(0, 100);
      const mensagemLivre = String(body.mensagem || '').trim().slice(0, 2000);

      if (nome.length < 2 || crp.length < 2 || !EMAIL_RE.test(email) || whatsapp.length < 6) {
        return responder(res, 400, { ok: false, erro: 'Preencha nome, CRP, WhatsApp e um e-mail válido.' });
      }

      const textoRegistro = `[Supervisão · CRP ${crp} | Formação: ${tempo || 'N/I'} | Modalidade: ${interesse || 'N/I'}]\n${mensagemLivre || '(Sem descrição adicional)'}`;
      await db().batch([
        {
          sql: `INSERT INTO biblioteca_mensagens (id, tema_chave, nome, email, whatsapp, mensagem, criado_em)
                VALUES (?, 'supervisao_terapeutas', ?, ?, ?, ?, ?)`,
          args: [novoId(), nome, email, whatsapp, textoRegistro, agoraSql()],
        },
        { sql: 'INSERT INTO limite_envios (ip_hash, criado_em) VALUES (?, ?)', args: [lim.h, lim.agora] },
        { sql: 'DELETE FROM limite_envios WHERE criado_em < ?', args: [lim.agora - 86400] },
      ], 'write');

      try {
        await enviarEmailNotificacao({
          tipo: 'Solicitação de Supervisão Clínica',
          remetente: nome,
          email,
          assunto: `[Supervisão] Solicitação de ${nome} (CRP ${crp})`,
          mensagem: mensagemLivre || '(Sem descrição adicional)',
          dadosExtras: { CRP: crp, Formacao: tempo, WhatsApp: whatsapp, Modalidade: interesse }
        });
      } catch (mailErr) {
        console.warn('[publico/supervisao] Aviso SMTP:', mailErr.message);
      }

      return responder(res, 201, { ok: true, mensagem: 'Solicitação de supervisão registrada com sucesso!' });
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
      const lim = await checarLimite(req, JANELA_S, MAX_ENVIOS);
      if (lim.bloqueado) {
        return responder(res, 429, { erro: 'Muitos envios em pouco tempo. Tente novamente em alguns minutos.' });
      }
      await db().batch([
        { sql: `INSERT INTO ${body.tabela} (${colunas.join(',')}) VALUES (${colunas.map(() => '?').join(',')})`, args: valores },
        { sql: 'INSERT INTO limite_envios (ip_hash, criado_em) VALUES (?, ?)', args: [lim.h, lim.agora] },
        { sql: 'DELETE FROM limite_envios WHERE criado_em < ?', args: [lim.agora - 86400] },
      ], 'write');
      return responder(res, 201, { ok: true });
    }

    if (acao === 'reagir') {
      const id = String(body.id || '').trim();
      if (!id) return responder(res, 400, { ok: false, erro: 'ID inválido.' });

      const h = ipHash(req);
      const agoraMs = Date.now();
      const bucket = reagirThrottle.get(h);
      if (bucket && agoraMs < bucket.exp) {
        if (bucket.n >= 30) {
          return responder(res, 429, { ok: false, erro: 'Muitas reações em sequência. Aguarde um momento.' });
        }
        bucket.n += 1;
      } else {
        if (reagirThrottle.size > 500) {
          for (const [k, v] of reagirThrottle) {
            if (agoraMs >= v.exp) reagirThrottle.delete(k);
          }
        }
        reagirThrottle.set(h, { n: 1, exp: agoraMs + 60_000 });
      }

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

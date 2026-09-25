// =====================================================================
// Acesso a dados — Revista Digital · Natalie Thedim
//
// Camada única. As páginas chamam apenas as funções daqui; elas falam com
// as rotas serverless em /api (Vercel), que por sua vez acessam o Turso.
// Nenhuma credencial de banco existe no navegador.
// =====================================================================

const DB = (() => {
  async function chamar(rota, { metodo = 'GET', corpo } = {}) {
    try {
      const r = await fetch(rota, {
        method: metodo,
        credentials: 'same-origin',
        headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, erro: json.erro || `erro ${r.status}`, status: r.status, json };
      return { ok: true, erro: null, json };
    } catch (e) {
      console.error('[DB]', e);
      return { ok: false, erro: 'offline', json: {} };
    }
  }

  function disponivel() { return true; }

  async function enviar(tabela, dados) {
    const { ok, erro } = await chamar('/api/publico?acao=enviar', { metodo: 'POST', corpo: { tabela, dados } });
    return { ok, erro };
  }

  async function listarAprovados(tabela, { limite = 20 } = {}) {
    const r = await chamar(`/api/publico?acao=aprovados&tabela=${encodeURIComponent(tabela)}&limite=${limite}`);
    return { ok: r.ok, dados: r.json.dados || [], erro: r.erro };
  }

  async function reagirDiario(id) {
    const { ok, erro } = await chamar('/api/publico?acao=reagir', { metodo: 'POST', corpo: { id } });
    return { ok, erro };
  }

  async function entrar(email, senha) {
    const { ok, erro } = await chamar('/api/admin?acao=entrar', { metodo: 'POST', corpo: { email, senha } });
    return { ok, erro };
  }

  async function sair() { await chamar('/api/admin?acao=sair', { metodo: 'POST' }); }

  async function sessaoAtual() {
    const r = await chamar('/api/admin?acao=sessao');
    return r.ok && r.json.ativa ? { ativa: true } : null;
  }

  function aoMudarSessao() {}

  async function listarTudo(tabela) {
    const r = await chamar(`/api/admin?acao=listar&tabela=${encodeURIComponent(tabela)}`);
    return { ok: r.ok, dados: r.json.dados || [], erro: r.erro };
  }

  async function moderar(tabela, id, novoStatus, extra = {}) {
    const { ok, erro } = await chamar('/api/admin?acao=moderar', {
      metodo: 'POST', corpo: { tabela, id, status: novoStatus, extra },
    });
    return { ok, erro };
  }

  return { disponivel, enviar, listarAprovados, reagirDiario, entrar, sair, sessaoAtual, aoMudarSessao, listarTudo, moderar };
})();

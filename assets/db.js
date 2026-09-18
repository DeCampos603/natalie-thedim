// =====================================================================
// Acesso a dados — Revista Digital · Natalie Thedim
//
// Camada única sobre o Supabase. As páginas nunca chamam o cliente do
// Supabase diretamente — chamam as funções daqui. Se um dia a forma de
// guardar os dados mudar, só este arquivo muda.
//
// Depende de, nesta ordem, no <head>/fim do <body> de cada página:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
//   <script src="./assets/supabase-config.js"></script>
//   <script src="./assets/db.js"></script>
// =====================================================================

const DB = (() => {
  const cfg = window.SUPABASE_CONFIG || {};
  const configurado = Boolean(cfg.url && cfg.anonKey);

  const cliente = configurado && window.supabase
    ? window.supabase.createClient(cfg.url, cfg.anonKey)
    : null;

  if (!configurado) {
    console.warn(
      '[DB] Supabase não configurado ainda — preencha assets/supabase-config.js. ' +
      'Formulários e listagens vão mostrar um aviso em vez de funcionar de verdade.'
    );
  }

  function disponivel() {
    return Boolean(cliente);
  }

  // ---- Envio público (Histórias, Cartas, Perguntas, Diário) ----------
  async function enviar(tabela, dados) {
    if (!cliente) return { ok: false, erro: 'offline' };
    const { error } = await cliente.from(tabela).insert(dados);
    if (error) {
      console.error(`[DB] erro ao enviar em ${tabela}:`, error);
      return { ok: false, erro: error.message };
    }
    return { ok: true, erro: null };
  }

  // ---- Leitura pública (só o que está aprovado, via RLS) -------------
  async function listarAprovados(tabela, { limite = 20, ordenarPor = 'criado_em' } = {}) {
    if (!cliente) return { ok: false, dados: [], erro: 'offline' };
    const { data, error } = await cliente
      .from(tabela)
      .select('*')
      .eq('status', 'aprovado')
      .order(ordenarPor, { ascending: false })
      .limit(limite);
    if (error) {
      console.error(`[DB] erro ao listar ${tabela}:`, error);
      return { ok: false, dados: [], erro: error.message };
    }
    return { ok: true, dados: data || [], erro: null };
  }

  async function reagirDiario(id) {
    if (!cliente) return { ok: false, erro: 'offline' };
    const { error } = await cliente.rpc('reagir_diario', { post_id: id });
    if (error) return { ok: false, erro: error.message };
    return { ok: true, erro: null };
  }

  // ---- Admin (moderação) ----------------------------------------------
  async function entrar(email, senha) {
    if (!cliente) return { ok: false, erro: 'offline' };
    const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
    if (error) return { ok: false, erro: error.message };
    return { ok: true, erro: null };
  }

  async function sair() {
    if (!cliente) return;
    await cliente.auth.signOut();
  }

  async function sessaoAtual() {
    if (!cliente) return null;
    const { data } = await cliente.auth.getSession();
    return data?.session || null;
  }

  function aoMudarSessao(callback) {
    if (!cliente) return;
    cliente.auth.onAuthStateChange((_evento, sessao) => callback(sessao));
  }

  async function listarTudo(tabela, { ordenarPor = 'criado_em' } = {}) {
    if (!cliente) return { ok: false, dados: [], erro: 'offline' };
    const { data, error } = await cliente
      .from(tabela)
      .select('*')
      .order(ordenarPor, { ascending: false });
    if (error) return { ok: false, dados: [], erro: error.message };
    return { ok: true, dados: data || [], erro: null };
  }

  async function moderar(tabela, id, novoStatus, extra = {}) {
    if (!cliente) return { ok: false, erro: 'offline' };
    const carimbo = tabela === 'perguntas' ? 'respondida_em' : 'moderado_em';
    const payload = { status: novoStatus, [carimbo]: new Date().toISOString(), ...extra };
    const { error } = await cliente.from(tabela).update(payload).eq('id', id);
    if (error) return { ok: false, erro: error.message };
    return { ok: true, erro: null };
  }

  return {
    disponivel,
    enviar,
    listarAprovados,
    reagirDiario,
    entrar,
    sair,
    sessaoAtual,
    aoMudarSessao,
    listarTudo,
    moderar,
  };
})();

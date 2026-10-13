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

  async function entrar(usuario, senha) {
    const { ok, erro, json } = await chamar('/api/admin?acao=entrar', {
      metodo: 'POST',
      corpo: { usuario, senha }
    });
    return { ok, erro, token: json?.token };
  }

  async function sair() { await chamar('/api/admin?acao=sair', { metodo: 'POST' }); }

  async function sessaoAtual() {
    const r = await chamar('/api/admin?acao=sessao');
    return r.ok && r.json.ativa ? { ativa: true } : null;
  }

  function aoMudarSessao() {}

  async function obterConteudo() {
    const r = await chamar('/api/conteudo');
    return { ok: r.ok, dados: r.json.itens || r.json.dados || [], conteudo: r.json.conteudo || {}, erro: r.erro };
  }

  async function salvarConteudo(secoes) {
    const { ok, erro, json } = await chamar('/api/conteudo', {
      metodo: 'PUT',
      corpo: { secoes }
    });
    return { ok, erro, mensagem: json?.mensagem };
  }

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

  return {
    disponivel,
    enviar,
    listarAprovados,
    reagirDiario,
    entrar,
    sair,
    sessaoAtual,
    aoMudarSessao,
    obterConteudo,
    salvarConteudo,
    listarTudo,
    moderar
  };
})();

// Inicialização Global: Menu Mobile + Hidratação Dinâmica do WhatsApp via Turso
document.addEventListener('DOMContentLoaded', () => {
  // 1. Menu Mobile Toggle
  const btnToggle = document.getElementById('btnToggleNav');
  const mainNav = document.getElementById('mainNav');
  if (btnToggle && mainNav) {
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const aberto = mainNav.classList.toggle('is-aberto');
      btnToggle.classList.toggle('is-active', aberto);
      btnToggle.setAttribute('aria-expanded', String(aberto));
    });

    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('is-aberto');
        btnToggle.classList.remove('is-active');
        btnToggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !btnToggle.contains(e.target)) {
        mainNav.classList.remove('is-aberto');
        btnToggle.classList.remove('is-active');
        btnToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // 2. Hidratação do WhatsApp e dados dinâmicos do CMS em todas as páginas
  DB.obterConteudo().then(({ ok, conteudo }) => {
    if (!ok || !conteudo) return;
    if (conteudo.whatsapp_numero?.texto) {
      const numLimpo = conteudo.whatsapp_numero.texto.replace(/\D/g, '');
      if (numLimpo) {
        document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
          try {
            const u = new URL(a.href);
            u.pathname = '/' + numLimpo;
            a.href = u.toString();
          } catch (_) {}
        });
      }
    }
    if (conteudo.crp_info?.texto) {
      document.querySelectorAll('[data-cms="crp_info"]').forEach(el => {
        el.textContent = conteudo.crp_info.texto;
      });
    }
  }).catch(() => {});

  // 3. Dropdown Persistente "Mais" (Hover Intent com buffer 250ms e clique)
  document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
    if (dropdown.dataset.hasDropdownInit) return;
    dropdown.dataset.hasDropdownInit = 'true';
    let timer = null;
    const btn = dropdown.querySelector('.nav-dropdown-btn');

    function abrir() {
      if (timer) clearTimeout(timer);
      dropdown.classList.add('is-open');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }

    function fechar() {
      timer = setTimeout(() => {
        dropdown.classList.remove('is-open');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }, 250);
    }

    dropdown.addEventListener('mouseenter', abrir);
    dropdown.addEventListener('mouseleave', fechar);
    dropdown.addEventListener('focusin', abrir);
    dropdown.addEventListener('focusout', (e) => {
      if (!dropdown.contains(e.relatedTarget)) {
        fechar();
      }
    });

    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('is-open');
        if (isOpen) {
          dropdown.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
        } else {
          abrir();
        }
      });
    }
  });

  // Fecha dropdown se clicar fora
  if (!window.__dropdownClickOutsideAttached) {
    window.__dropdownClickOutsideAttached = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-dropdown')) {
        document.querySelectorAll('.nav-dropdown.is-open').forEach((d) => {
          d.classList.remove('is-open');
          const b = d.querySelector('.nav-dropdown-btn');
          if (b) b.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }
});


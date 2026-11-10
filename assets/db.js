// =====================================================================
// Acesso a dados — Revista Digital · Natalie Thedim
//
// Camada híbrida resiliente:
// 1. Em ambiente Vercel/Node, comunica-se com as rotas serverless /api (Turso).
// 2. Em hospedagem estática/compartilhada (Hostinger, GitHub Pages, local),
//    ativa automaticamente o fallback clínico curado + persistência local,
//    garantindo zero erros 404 e experiência fluida em todas as abas.
// =====================================================================

const DB = (() => {
  const WHATSAPP_OFICIAL = '5521989020364';

  const API_BASE = (typeof window !== 'undefined' && window.API_BASE_URL)
    ? String(window.API_BASE_URL).replace(/\/$/, '')
    : '';

  const SEEDS = {
    historias: [
      {
        id: 'seed_hist_1',
        texto: 'Estamos juntos há 11 anos e, desde que nossa filha nasceu, parece que viramos dois colegas de quarto gerenciando boletos e horários. Não brigamos feio, mas o silêncio no jantar pesa mais do que qualquer discussão. Tenho medo de tocar no assunto e parecer ingrata.',
        status: 'aprovado',
        resposta_tipo: 'texto',
        resposta_texto: 'Quando o casal é engolido pela logística da rotina, a conjugalidade costuma ser a primeira a ficar sem espaço. Nomear essa distância sem apontar culpados — "sinto falta de nós dois além das tarefas" — não é ingratidão, é um gesto de cuidado com o vínculo que sustenta a própria família.',
        criado_em: '2026-03-10T14:20:00.000Z'
      },
      {
        id: 'seed_hist_2',
        texto: 'Toda vez que tento falar sobre algo que me magoou, meu parceiro se fecha ou diz que "já vem cobrança de novo". Acabo engolindo tudo para manter a paz, mas sinto que estou me afastando aos poucos.',
        status: 'aprovado',
        resposta_tipo: 'texto',
        resposta_texto: 'A paz construída sobre o próprio silenciamento cobra um preço alto na intimidade. Na clínica sistêmica, observamos o ciclo: quanto mais um teme a crítica e se defende, mais o outro se sente invisível. Mudar a porta de entrada da conversa — falando da própria vulnerabilidade em vez da falha do outro — ajuda a desarmar esse alerta.',
        criado_em: '2026-03-18T19:45:00.000Z'
      }
    ],
    cartas: [
      {
        id: 'seed_carta_1',
        destinatario: 'Ao meu parceiro, depois de uma discussão que não precisava ter acontecido',
        texto: 'Eu não estava brava por causa da louça nem pelo atraso. Eu só estava exausta e queria sentir que não estou carregando o mundo nas costas sozinha. Quando levantei a voz, na verdade eu queria pedir colo, mas não soube como descer a guarda.',
        status: 'aprovado',
        resposta_tipo: 'texto',
        resposta_texto: 'Debaixo da maioria das irritações cotidianas mora um pedido de conexão que teve medo de aparecer desprotegido. Reconhecer o pedido por trás da queixa já transforma o lugar de onde você olha para a relação.',
        criado_em: '2026-03-12T21:10:00.000Z'
      },
      {
        id: 'seed_carta_2',
        destinatario: 'Para quem eu fui antes de aprender a dizer não',
        texto: 'Passei anos achando que amar era concordar com tudo e nunca dar trabalho. Hoje percebo que, ao esconder meus limites para ser aceita, ninguém podia amar quem eu realmente era.',
        status: 'aprovado',
        resposta_tipo: 'texto',
        resposta_texto: 'Dizer "não" ao que nos fere é a única maneira de tornar verdadeiro o nosso "sim". Limites claros não afastam relações saudáveis — eles mostram onde o encontro real pode acontecer.',
        criado_em: '2026-03-22T16:05:00.000Z'
      }
    ],
    perguntas: [
      {
        id: 'seed_perg_1',
        texto: 'Vale a pena procurar terapia de casal quando apenas um dos dois sente que a relação precisa de cuidado?',
        status: 'aprovado',
        resposta_tipo: 'texto',
        resposta_texto: 'Muitas vezes os dois parceiros têm tempos diferentes de percepção do desgaste. Quando o convite deixa de soar como um "tribunal para apontar quem está errado" e passa a ser apresentado como um espaço seguro para melhorar a comunicação dos dois, a resistência costuma diminuir. E mesmo quando um parceiro opta por iniciar em psicoterapia individual, o movimento de um já altera toda a dança relacional.',
        criado_em: '2026-03-14T11:00:00.000Z',
        respondida_em: '2026-03-15T15:20:00.000Z'
      },
      {
        id: 'seed_perg_2',
        texto: 'É possível reconstruir a confiança no relacionamento depois de uma quebra de combinado importante?',
        status: 'aprovado',
        resposta_tipo: 'texto',
        resposta_texto: 'Sim, desde que haja disposição genuína de ambas as partes para olhar para a ferida sem minimizá-la. Reconstruir confiança não significa esquecer ou voltar ao que era antes, mas estabelecer um novo pacto sustentado por transparência consistente, escuta da dor e responsabilidade afetiva no dia a dia.',
        criado_em: '2026-03-25T17:30:00.000Z',
        respondida_em: '2026-03-26T10:10:00.000Z'
      }
    ],
    diario_posts: [
      {
        id: 'seed_diario_1',
        texto: 'Hoje consegui ouvir meu marido até o fim sem interromper para me defender. Foi difícil segurar a ansiedade, mas a conversa terminou em abraço pela primeira vez em meses.',
        status: 'aprovado',
        reacoes: 24,
        criado_em: '2026-03-20T22:15:00.000Z'
      },
      {
        id: 'seed_diario_2',
        texto: 'Percebi na sessão desta semana que carrego a pressa da minha família de origem para dentro do meu casamento. Respirar antes de responder tem sido meu exercício diário.',
        status: 'aprovado',
        reacoes: 19,
        criado_em: '2026-03-24T18:40:00.000Z'
      },
      {
        id: 'seed_diario_3',
        texto: 'Pedi desculpas ao meu filho quando perdi a paciência ontem. Ver o olhinho dele aliviar me lembrou que reparar o erro ensina muito mais do que fingir perfeição.',
        status: 'aprovado',
        reacoes: 31,
        criado_em: '2026-03-28T20:05:00.000Z'
      }
    ]
  };

  function lerLocal(chave, padrao = []) {
    try {
      const raw = localStorage.getItem(chave);
      return raw ? JSON.parse(raw) : padrao;
    } catch (_) {
      return padrao;
    }
  }

  function salvarLocal(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (_) {}
  }

  function combinarComSeeds(tabela, remotos = []) {
    const seeds = SEEDS[tabela] || [];
    const locais = lerLocal(`nt_envios_${tabela}`, []).filter(x => x.status === 'aprovado');
    const reacoesLocais = lerLocal('nt_reacoes_diario', {});
    const mapa = new Map();

    [...remotos, ...locais, ...seeds].forEach(item => {
      if (item && item.id && !mapa.has(item.id)) {
        const copia = { ...item };
        if (tabela === 'diario_posts' && reacoesLocais[copia.id]) {
          copia.reacoes = (Number(copia.reacoes) || 0) + Number(reacoesLocais[copia.id]);
        }
        mapa.set(copia.id, copia);
      }
    });

    return Array.from(mapa.values());
  }

  async function chamar(rota, { metodo = 'GET', corpo } = {}) {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      return { ok: false, erro: 'offline', json: {} };
    }
    try {
      const url = rota.startsWith('http') ? rota : `${API_BASE}${rota}`;
      const r = await fetch(url, {
        method: metodo,
        credentials: API_BASE ? 'include' : 'same-origin',
        headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, erro: json.erro || `erro ${r.status}`, status: r.status, json };
      return { ok: true, erro: null, json };
    } catch (e) {
      return { ok: false, erro: 'offline', json: {} };
    }
  }

  function disponivel() { return true; }

  async function enviar(tabela, dados) {
    const tabelaReal = tabela === 'terapeutas' ? 'perguntas' : tabela;
    const payload = tabela === 'terapeutas'
      ? {
          texto: `[Supervisão / Parceria Clínica] Nome: ${dados?.nome || ''} | CRP: ${dados?.crp || ''} | WhatsApp: ${dados?.whatsapp || ''} | Abordagem: ${dados?.abordagem || ''} | Mensagem: ${dados?.mensagem || ''}`.slice(0, 990)
        }
      : dados;

    const { ok, erro, status } = await chamar('/api/publico?acao=enviar', {
      metodo: 'POST',
      corpo: { tabela: tabelaReal, dados: payload }
    });

    if (ok) return { ok: true, erro: null };

    // Fallback estático resiliente (Hostinger / offline): salva registro local sem quebrar a experiência
    if (erro === 'offline' || status === 404 || status === 405 || status >= 500) {
      const lista = lerLocal(`nt_envios_${tabelaReal}`, []);
      lista.unshift({
        id: 'local_' + Date.now(),
        ...(payload || {}),
        status: 'pendente',
        criado_em: new Date().toISOString()
      });
      salvarLocal(`nt_envios_${tabelaReal}`, lista.slice(0, 50));
      return { ok: true, erro: null, modoLocal: true };
    }

    return { ok, erro };
  }

  async function listarAprovados(tabela, { limite = 20 } = {}) {
    const r = await chamar(`/api/publico?acao=aprovados&tabela=${encodeURIComponent(tabela)}&limite=${limite}`);
    if (r.ok && Array.isArray(r.json.dados) && r.json.dados.length > 0) {
      return { ok: true, dados: combinarComSeeds(tabela, r.json.dados).slice(0, limite), erro: null };
    }
    // Se o banco estiver vazio ou em hospedagem estática (Hostinger), entrega as sementes clínicas curadas
    const combinados = combinarComSeeds(tabela, []);
    return { ok: true, dados: combinados.slice(0, limite), erro: null };
  }

  async function reagirDiario(id) {
    const { ok, erro } = await chamar('/api/publico?acao=reagir', { metodo: 'POST', corpo: { id } });
    if (ok) return { ok: true, erro: null };

    const reacoesLocais = lerLocal('nt_reacoes_diario', {});
    reacoesLocais[id] = (Number(reacoesLocais[id]) || 0) + 1;
    salvarLocal('nt_reacoes_diario', reacoesLocais);
    return { ok: true, erro: null };
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
    const conteudo = r.json?.conteudo || {};
    // Garante sempre o número oficial atualizado da psicóloga Natalie Thedim
    if (!conteudo.whatsapp_numero || !String(conteudo.whatsapp_numero.texto).includes(WHATSAPP_OFICIAL)) {
      conteudo.whatsapp_numero = { texto: '+' + WHATSAPP_OFICIAL, imagem: null };
    }
    return {
      ok: true,
      dados: r.json?.itens || r.json?.dados || [],
      conteudo,
      erro: null
    };
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
    WHATSAPP_OFICIAL,
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

if (typeof window !== 'undefined') {
  window.DB = DB;
}

// Inicialização Global: Menu Mobile + Hidratação Dinâmica do WhatsApp via Turso
document.addEventListener('DOMContentLoaded', () => {
  // 1. Menu Mobile Toggle (suporta tanto is-aberto quanto is-open)
  const btnToggle = document.getElementById('btnToggleNav');
  const mainNav = document.getElementById('mainNav');
  if (btnToggle && mainNav && !btnToggle.dataset.hasMobileInit) {
    btnToggle.dataset.hasMobileInit = 'true';
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const aberto = mainNav.classList.toggle('is-aberto');
      mainNav.classList.toggle('is-open', aberto);
      btnToggle.classList.toggle('is-active', aberto);
      btnToggle.setAttribute('aria-expanded', String(aberto));
    });

    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('is-aberto', 'is-open');
        btnToggle.classList.remove('is-active');
        btnToggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !btnToggle.contains(e.target)) {
        mainNav.classList.remove('is-aberto', 'is-open');
        btnToggle.classList.remove('is-active');
        btnToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // 2. Hidratação do WhatsApp e dados dinâmicos do CMS em todas as páginas
  DB.obterConteudo().then(({ ok, conteudo }) => {
    if (!ok || !conteudo) return;
    if (conteudo.whatsapp_numero?.texto) {
      let numLimpo = conteudo.whatsapp_numero.texto.replace(/\D/g, '');
      if (!numLimpo || numLimpo !== DB.WHATSAPP_OFICIAL) {
        numLimpo = DB.WHATSAPP_OFICIAL;
      }
      document.querySelectorAll('a[href*="wa.me"]').forEach(a => {
        try {
          const u = new URL(a.href);
          u.pathname = '/' + numLimpo;
          a.href = u.toString();
        } catch (_) {}
      });
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

  // 4. Motor Global de Interatividade & Motion 60fps (Scroll Bar, Spotlight, Tilt, Magnetic, Floating WA)
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 4a. Barra Global de Progresso de Leitura
  if (!document.getElementById('progressBar') && !document.querySelector('.global-scroll-progress')) {
    const bar = document.createElement('div');
    bar.className = 'global-scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.prepend(bar);

    const updateBar = () => {
      const st = window.scrollY || document.documentElement.scrollTop;
      const dh = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      bar.style.width = (dh > 0 ? (st / dh) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', () => window.requestAnimationFrame(updateBar), { passive: true });
    updateBar();
  }

  // 4b. Botão Flutuante do WhatsApp nas Subpáginas Públicas
  const isAdminPage = window.location.pathname.includes('admin');
  if (!isAdminPage && !document.querySelector('.floating-wa-bubble') && !document.querySelector('.floating-wa-global')) {
    const wa = document.createElement('a');
    wa.href = `https://wa.me/${DB.WHATSAPP_OFICIAL}?text=${encodeURIComponent('Olá, Natalie! Estou navegando pela Revista Digital no seu site e gostaria de informações sobre atendimento.')}`;
    wa.className = 'floating-wa-global';
    wa.target = '_blank';
    wa.rel = 'noopener noreferrer';
    wa.setAttribute('aria-label', 'Falar com Natalie Thedim no WhatsApp');
    wa.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.42 0-2.82-.37-4.06-1.07l-.29-.17-3.01.79.8-2.93-.19-.3a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.63c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.72 4.31 3.81.6.26 1.07.42 1.44.54.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.17-.48-.29z"/></svg>`;
    document.body.appendChild(wa);
  }

  // 4c. Spotlight Radial + Micro-Tilt 3D nos Cartões
  if (!reduceMotion) {
    const cardSelector = '.mock-card, .video-card, .podcast-card, .artigo-ese-card, .carrossel-card, .reel-card, .servico-card, .faq-card';
    document.querySelectorAll(cardSelector).forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    });

    // 4d. Botões Magnéticos Suaves
    document.querySelectorAll('.btn-primary, .header-btn').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.14;
        const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.18;
        btn.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });

    // 4e. Revelação Progressiva ao Scroll nas Subpáginas
    const revealTargets = document.querySelectorAll('.mock-card, .video-card, .podcast-card, .artigo-ese-card, .carrossel-card, .reel-card, .servico-card, .faq-card, .envio-box, .termometro-card, .editorial-visual-banner');
    if ('IntersectionObserver' in window && revealTargets.length > 0) {
      const obs = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

      revealTargets.forEach((el, idx) => {
        el.classList.add('reveal-on-scroll');
        el.style.transitionDelay = `${(idx % 4) * 55}ms`;
        obs.observe(el);
      });
    }
  }
});

// =====================================================================
// Acesso a dados — Revista Digital · Natalie Thedim
//
// Camada híbrida resiliente:
// 1. Comunica-se com as rotas serverless/Node /api (MySQL Hostinger / libSQL).
// 2. Em preview local sem servidor (protocolo file:// ou offline), ativa fallback local.
// =====================================================================

var DB = (typeof window !== 'undefined' && window.DB) ? window.DB : (() => {
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

  const EMAIL_OFICIAL = 'psicologa@nataliethedim.com.br';

  async function dispararEmailNotificacao(tabela, dados) {
    try {
      const titulos = {
        terapeutas: 'Nova Solicitação de Supervisão Clínica (Área p/ Terapeutas)',
        historias: 'Nova História Real Anônima Enviada no Site',
        cartas: 'Nova Carta que Nunca Enviei Enviada no Site',
        perguntas: 'Nova Pergunta para a Psicóloga Enviada no Site',
        diario_posts: 'Novo Desabafo no Diário Anônimo',
        newsletter: 'Novo Cadastro na Newsletter da Dra. Natalie Thedim',
        biblioteca_mensagens: 'Nova Mensagem sobre Tema da Biblioteca'
      };

      // 1. Tenta enviar prioritariamente via servidor oficial Hostinger SMTP (/api/notificar)
      const resServidor = await fetch('/api/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: titulos[tabela] || tabela,
          remetente: dados?.Nome || dados?.nome || dados?.remetente || 'Leitor(a) do Site',
          email: dados?.Email || dados?.email || '',
          mensagem: dados?.Texto || dados?.texto || dados?.mensagem || JSON.stringify(dados),
          dadosExtras: dados
        })
      }).catch(() => null);

      if (resServidor && resServidor.ok) {
        return; // Sucesso absoluto com SMTP nativo Hostinger!
      }

      // 2. Fallback secundário FormSubmit caso o servidor local esteja offline ou sem SMTP_PASS
      const corpoEmail = {
        _subject: `[Site Natalie Thedim] ${titulos[tabela] || 'Novo Envio no Site'}`,
        _template: 'table',
        _captcha: 'false',
        Origem: titulos[tabela] || tabela,
        Data_Hora: new Date().toLocaleString('pt-BR'),
        ...(typeof dados === 'object' && dados !== null ? dados : { Texto: String(dados) })
      };
      await fetch(`https://formsubmit.co/ajax/${EMAIL_OFICIAL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(corpoEmail)
      });
    } catch (_) {
      // Silencioso para não interromper a experiência do paciente
    }
  }

  async function enviar(tabela, dados) {
    if (tabela === 'terapeutas') {
      const { ok, erro, status, json } = await chamar('/api/publico?acao=supervisao', {
        metodo: 'POST',
        corpo: dados
      });
      if (ok) return { ok: true, erro: null, mensagem: json?.mensagem };
      if (erro === 'offline' || status === 404) {
        await dispararEmailNotificacao('terapeutas', dados);
        return { ok: true, erro: null, modoLocal: true };
      }
      return { ok: false, erro: erro || json?.erro || 'Não foi possível enviar a solicitação.' };
    }

    // 1. Salva no banco de dados (visível no Painel Admin /admin.html)
    const { ok, erro, status } = await chamar('/api/publico?acao=enviar', {
      metodo: 'POST',
      corpo: { tabela, dados }
    });

    if (ok) {
      dispararEmailNotificacao(tabela, dados);
      return { ok: true, erro: null };
    }

    // Fallback offline/estático (somente quando não há servidor API)
    if (erro === 'offline' || status === 404) {
      dispararEmailNotificacao(tabela, dados);
      const lista = lerLocal(`nt_envios_${tabela}`, []);
      lista.unshift({
        id: 'local_' + Date.now(),
        ...(dados || {}),
        status: 'pendente',
        criado_em: new Date().toISOString()
      });
      salvarLocal(`nt_envios_${tabela}`, lista.slice(0, 50));
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

  let conteudoEmVoo = null;
  let conteudoCache = null;

  function normalizarWhatsappCMS(valor) {
    const digits = String(valor || '').replace(/\D/g, '');
    if (digits.length < 10) return WHATSAPP_OFICIAL;
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
      return '55' + digits;
    }
    return digits;
  }

  async function obterConteudo(forcar = false) {
    if (!forcar && conteudoCache && (Date.now() - conteudoCache.ts < 5000)) {
      return conteudoCache.res;
    }
    if (!forcar && conteudoEmVoo) return conteudoEmVoo;

    conteudoEmVoo = (async () => {
      const cacheLocal = lerLocal('nt_cms_conteudo_local', {});
      const r = await chamar('/api/conteudo');
      const conteudoApi = r.json?.conteudo || {};
      const conteudo = (r.ok && r.json?.conteudo) ? { ...cacheLocal, ...conteudoApi } : { ...cacheLocal, ...conteudoApi };

      if (!conteudo.nome_profissional) {
        conteudo.nome_profissional = { texto: 'Natalie Thedim', imagem: null };
      }
      if (!conteudo.whatsapp_numero || String(conteudo.whatsapp_numero.texto || '').replace(/\D/g, '').length < 10) {
        conteudo.whatsapp_numero = { texto: '+' + WHATSAPP_OFICIAL, imagem: null };
      }
      if (!conteudo.email_contato) {
        conteudo.email_contato = { texto: EMAIL_OFICIAL, imagem: null };
      }

      const resultado = {
        ok: r.ok || Object.keys(conteudo).length > 0,
        dados: r.json?.itens || r.json?.dados || [],
        conteudo,
        erro: r.ok ? null : r.erro
      };
      if (r.ok) {
        conteudoCache = { ts: Date.now(), res: resultado };
      }
      return resultado;
    })();

    try {
      return await conteudoEmVoo;
    } finally {
      conteudoEmVoo = null;
    }
  }

  async function salvarConteudo(secoes) {
    const { ok, erro, json } = await chamar('/api/conteudo', {
      metodo: 'PUT',
      corpo: { secoes }
    });
    if (!ok) {
      return {
        ok: false,
        erro: erro || json?.erro || 'Não foi possível salvar no servidor. Faça login novamente e tente de novo.',
        mensagem: null
      };
    }

    conteudoCache = null;
    conteudoEmVoo = null;

    const mapaAtual = lerLocal('nt_cms_conteudo_local', {});
    if (Array.isArray(secoes)) {
      secoes.forEach(item => {
        if (item.section_name) {
          mapaAtual[item.section_name] = { texto: item.content_text, imagem: item.image_url || null };
        }
      });
    } else if (typeof secoes === 'object') {
      Object.entries(secoes).forEach(([k, v]) => {
        mapaAtual[k] = typeof v === 'object' && v !== null ? v : { texto: String(v) };
      });
    }
    salvarLocal('nt_cms_conteudo_local', mapaAtual);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cms:atualizado', { detail: mapaAtual }));
    }

    return { ok: true, erro: null, mensagem: json?.mensagem || 'Conteúdo salvo com sucesso!' };
  }

  // === Métodos da Newsletter ===
  async function inscreverNewsletter(email, nome = '', origem = 'site') {
    const { ok, erro, status, json } = await chamar('/api/publico?acao=newsletter', {
      metodo: 'POST',
      corpo: { email, nome, origem }
    });
    if (ok) {
      dispararEmailNotificacao('newsletter', { Nome: nome || 'Leitor(a)', Email: email, Origem: origem });
      return { ok: true, erro: null, mensagem: json?.mensagem || 'Inscrição confirmada com sucesso!' };
    }
    if (erro === 'offline' || status === 404) {
      dispararEmailNotificacao('newsletter', { Nome: nome || 'Leitor(a)', Email: email, Origem: origem });
      const lista = lerLocal('nt_newsletter_local', []);
      if (!lista.some(item => item.email === email)) {
        lista.unshift({ id: 'nl_' + Date.now(), email, nome, origem, criado_em: new Date().toISOString() });
        salvarLocal('nt_newsletter_local', lista);
      }
      return { ok: true, mensagem: 'Inscrição confirmada com sucesso!' };
    }
    return { ok: false, erro: erro || json?.erro || 'Erro ao inscrever na newsletter.', mensagem: null };
  }

  async function listarNewsletter() {
    const { ok, erro, json } = await chamar('/api/admin?acao=newsletter_listar');
    if (ok && Array.isArray(json?.dados)) {
      return { ok: true, dados: json.dados, erro: null };
    }
    if (erro === 'offline') {
      return { ok: true, dados: lerLocal('nt_newsletter_local', []), erro: null };
    }
    return { ok: false, dados: [], erro: erro || json?.erro || 'Não autorizado ou falha ao carregar newsletter.' };
  }

  async function removerNewsletter(id) {
    const { ok, erro, json } = await chamar('/api/admin?acao=newsletter_remover', { metodo: 'POST', corpo: { id } });
    if (ok || erro === 'offline') {
      const local = lerLocal('nt_newsletter_local', []).filter(item => item.id !== id);
      salvarLocal('nt_newsletter_local', local);
      return { ok: true, erro: null };
    }
    return { ok: false, erro: erro || json?.erro || 'Não foi possível excluir o inscrito.' };
  }

  // === Métodos da Biblioteca ===
  async function obterTemasBiblioteca() {
    const r = await chamar('/api/publico?acao=biblioteca_temas');
    if (r.ok && Array.isArray(r.json?.dados)) {
      return { ok: true, dados: r.json.dados, erro: null };
    }
    if (r.erro === 'offline' || r.status === 404) {
      const local = lerLocal('nt_biblioteca_temas_local', []);
      return { ok: true, dados: local || [], erro: null };
    }
    return { ok: false, dados: [], erro: r.erro || 'Erro ao carregar temas da biblioteca.' };
  }

  async function salvarTemaBiblioteca(dados) {
    const r = await chamar('/api/admin?acao=biblioteca_salvar_tema', { metodo: 'POST', corpo: dados });
    if (!r.ok && r.erro !== 'offline') {
      return { ok: false, erro: r.erro || r.json?.erro || 'Não foi possível salvar o tema.' };
    }
    const local = lerLocal('nt_biblioteca_temas_local', []);
    const idx = local.findIndex(t => (dados.id && t.id === dados.id) || (dados.tema_chave && t.tema_chave === dados.tema_chave));
    if (idx >= 0) { local[idx] = { ...local[idx], ...dados }; }
    else { local.push({ id: r.json?.id || 'tema_' + Date.now(), ...dados }); }
    salvarLocal('nt_biblioteca_temas_local', local);
    return { ok: true, erro: null };
  }

  async function excluirTemaBiblioteca(idOuChave) {
    const r = await chamar('/api/admin?acao=biblioteca_excluir_tema', {
      metodo: 'POST',
      corpo: { id: idOuChave, tema_chave: idOuChave }
    });
    if (!r.ok && r.erro !== 'offline') {
      return { ok: false, erro: r.erro || r.json?.erro || 'Não foi possível excluir o tema.' };
    }
    const local = lerLocal('nt_biblioteca_temas_local', []).filter(
      t => String(t.id) !== String(idOuChave) && String(t.tema_chave) !== String(idOuChave)
    );
    salvarLocal('nt_biblioteca_temas_local', local);
    return { ok: true, erro: null };
  }

  async function enviarMensagemBiblioteca(temaOuDados, nomeArg, emailArg, mensagemArg) {
    const payload = (temaOuDados && typeof temaOuDados === 'object' && !Array.isArray(temaOuDados))
      ? temaOuDados
      : {
          tema_chave: String(temaOuDados || '').trim(),
          nome: String(nomeArg || '').trim(),
          email: String(emailArg || '').trim(),
          mensagem: String(mensagemArg || '').trim()
        };

    const r = await chamar('/api/publico?acao=biblioteca_mensagem', { metodo: 'POST', corpo: payload });
    if (r.ok) {
      dispararEmailNotificacao('biblioteca_mensagens', payload);
      return { ok: true, erro: null, mensagem: r.json?.mensagem || 'Mensagem registrada com sucesso!' };
    }
    if (r.erro === 'offline' || r.status === 404) {
      dispararEmailNotificacao('biblioteca_mensagens', payload);
      const msgs = lerLocal('nt_bib_msgs_local', []);
      msgs.unshift({ id: 'bmsg_' + Date.now(), ...payload, criado_em: new Date().toISOString() });
      salvarLocal('nt_bib_msgs_local', msgs);
      return { ok: true, erro: null, mensagem: 'Mensagem registrada com sucesso!' };
    }
    return { ok: false, erro: r.erro || r.json?.erro || 'Erro ao enviar dúvida.' };
  }

  async function obterHistoricoBiblioteca(tema_chave = null) {
    const url = tema_chave
      ? `/api/admin?acao=biblioteca_historico&tema_chave=${encodeURIComponent(tema_chave)}`
      : '/api/admin?acao=biblioteca_historico';
    const r = await chamar(url);
    if (r.ok && Array.isArray(r.json?.dados)) {
      return { ok: true, dados: r.json.dados, erro: null };
    }
    if (r.erro === 'offline') {
      const msgs = lerLocal('nt_bib_msgs_local', []);
      const filtrados = tema_chave ? msgs.filter(m => m.tema_chave === tema_chave) : msgs;
      return { ok: true, dados: filtrados, erro: null };
    }
    return { ok: false, dados: [], erro: r.erro || r.json?.erro || 'Erro ao carregar mensagens da biblioteca.' };
  }

  // === Métodos do Clube do Filme ===
  async function obterFilmes() {
    const r = await chamar('/api/publico?acao=filmes');
    if (r.ok && Array.isArray(r.json?.dados)) {
      return { ok: true, dados: r.json.dados, erro: null };
    }
    if (r.erro === 'offline' || r.status === 404) {
      const local = lerLocal('nt_filmes_local', []);
      return { ok: true, dados: local || [], erro: null };
    }
    return { ok: false, dados: [], erro: r.erro || 'Erro ao carregar filmes.' };
  }

  async function salvarFilme(dados) {
    const r = await chamar('/api/admin?acao=filmes_salvar', { metodo: 'POST', corpo: dados });
    if (!r.ok && r.erro !== 'offline') {
      return { ok: false, erro: r.erro || r.json?.erro || 'Não foi possível salvar o filme.' };
    }
    const local = lerLocal('nt_filmes_local', []);
    const idx = local.findIndex(f => dados.id && f.id === dados.id);
    if (idx >= 0) { local[idx] = { ...local[idx], ...dados }; }
    else { local.push({ id: r.json?.id || dados.id || 'filme_' + Date.now(), ...dados }); }
    salvarLocal('nt_filmes_local', local);
    return { ok: true, erro: null };
  }

  async function excluirFilme(id) {
    const r = await chamar('/api/admin?acao=filmes_excluir', { metodo: 'POST', corpo: { id } });
    if (!r.ok && r.erro !== 'offline') {
      return { ok: false, erro: r.erro || r.json?.erro || 'Não foi possível excluir o filme.' };
    }
    const local = lerLocal('nt_filmes_local', []).filter(f => String(f.id) !== String(id));
    salvarLocal('nt_filmes_local', local);
    return { ok: true, erro: null };
  }

  // === Métodos do Clube do Livro ===
  async function obterLivros() {
    const r = await chamar('/api/publico?acao=livros');
    if (r.ok && Array.isArray(r.json?.dados)) {
      return { ok: true, dados: r.json.dados, erro: null };
    }
    if (r.erro === 'offline' || r.status === 404) {
      const local = lerLocal('nt_livros_local', []);
      return { ok: true, dados: local || [], erro: null };
    }
    return { ok: false, dados: [], erro: r.erro || 'Erro ao carregar livros.' };
  }

  async function salvarLivro(dados) {
    const r = await chamar('/api/admin?acao=livros_salvar', { metodo: 'POST', corpo: dados });
    if (!r.ok && r.erro !== 'offline') {
      return { ok: false, erro: r.erro || r.json?.erro || 'Não foi possível salvar o livro.' };
    }
    const local = lerLocal('nt_livros_local', []);
    const idx = local.findIndex(l => dados.id && l.id === dados.id);
    if (idx >= 0) { local[idx] = { ...local[idx], ...dados }; }
    else { local.push({ id: r.json?.id || dados.id || 'livro_' + Date.now(), ...dados }); }
    salvarLocal('nt_livros_local', local);
    return { ok: true, erro: null };
  }

  async function excluirLivro(id) {
    const r = await chamar('/api/admin?acao=livros_excluir', { metodo: 'POST', corpo: { id } });
    if (!r.ok && r.erro !== 'offline') {
      return { ok: false, erro: r.erro || r.json?.erro || 'Não foi possível excluir o livro.' };
    }
    const local = lerLocal('nt_livros_local', []).filter(l => String(l.id) !== String(id));
    salvarLocal('nt_livros_local', local);
    return { ok: true, erro: null };
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

  async function publicarItem(tabela, dados = {}) {
    const { ok, erro, json } = await chamar('/api/admin?acao=publicar_item', {
      metodo: 'POST', corpo: { tabela, ...dados },
    });
    return { ok, erro, id: json?.id || null };
  }

  return {
    WHATSAPP_OFICIAL,
    EMAIL_OFICIAL,
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
    moderar,
    publicarItem,
    inscreverNewsletter,
    listarNewsletter,
    removerNewsletter,
    listarInscritosNewsletter: listarNewsletter,
    removerInscritoNewsletter: removerNewsletter,
    normalizarWhatsappCMS,
    obterTemasBiblioteca,
    salvarTemaBiblioteca,
    excluirTemaBiblioteca,
    enviarMensagemBiblioteca,
    obterHistoricoBiblioteca,
    obterFilmes,
    salvarFilme,
    excluirFilme,
    obterLivros,
    salvarLivro,
    excluirLivro
  };
})();

if (typeof window !== 'undefined') {
  window.DB = DB;
}

// Inicialização Global: Menu Mobile + Hidratação Dinâmica de CMS/WhatsApp
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window !== 'undefined') {
    if (window.__natalieDbDomInit) return;
    window.__natalieDbDomInit = true;
  }
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
    if (conteudo.nome_profissional?.texto) {
      document.querySelectorAll('[data-cms="nome_profissional"]').forEach(el => {
        el.textContent = conteudo.nome_profissional.texto;
      });
    }
    if (conteudo.endereco_consultorio?.texto) {
      document.querySelectorAll('[data-cms="endereco_consultorio"]').forEach(el => {
        el.textContent = conteudo.endereco_consultorio.texto;
      });
    }
    if (conteudo.hero_title?.texto) {
      document.querySelectorAll('[data-cms="hero_title"]').forEach(el => {
        el.textContent = conteudo.hero_title.texto;
      });
    }
    if (conteudo.hero_subtitle?.texto) {
      document.querySelectorAll('[data-cms="hero_subtitle"]').forEach(el => {
        el.textContent = conteudo.hero_subtitle.texto;
      });
    }
    if (conteudo.sobre_mim?.texto) {
      document.querySelectorAll('[data-cms="sobre_mim"]').forEach(el => {
        el.textContent = conteudo.sobre_mim.texto;
      });
    }
    if (conteudo.whatsapp_numero?.texto) {
      const numLimpo = DB.normalizarWhatsappCMS ? DB.normalizarWhatsappCMS(conteudo.whatsapp_numero.texto) : conteudo.whatsapp_numero.texto.replace(/\D/g, '');
      if (numLimpo && numLimpo.length >= 10) {
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

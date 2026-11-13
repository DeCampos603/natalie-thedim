// Camada "agent-ready" do site: servidor MCP somente leitura (Streamable HTTP, sem estado).
// Expõe só informação pública que já está no site. Não recebe nem grava dado pessoal e não agenda nada:
// o agendamento acontece pelo link do WhatsApp, aberto pela própria pessoa.
//
// Manter os textos em sincronia com assets/webmcp.js (versão que roda no navegador) e llms.txt.

const BASE = 'https://nataliethedim.com.br';
const WHATSAPP = '5521989020364';
const EMAIL = 'psicologa@nataliethedim.com.br';

export const SERVER_INFO = {
  name: 'natalie-thedim-site',
  title: 'Natalie Thedim, Psicóloga Clínica (informações públicas)',
  version: '1.0.0',
};
const PROTOCOLOS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export const PAGINAS = [
  { url: '/', titulo: 'Home: terapia de casal e individual no Rio de Janeiro e online', desc: 'Apresentação, modalidades de atendimento e agendamento.' },
  { url: '/sobre', titulo: 'Sobre Natalie Thedim', desc: 'Formação, abordagem e modalidades de atendimento.' },
  { url: '/contato', titulo: 'Contato e agendamento', desc: 'WhatsApp, e-mail, Doctoralia, redes e local de atendimento.' },
  { url: '/historias', titulo: 'Histórias reais', desc: 'Relatos anônimos de leitores com reflexão da psicóloga.' },
  { url: '/cartas', titulo: 'Cartas que nunca enviei', desc: 'Cartas anônimas lidas e analisadas pela psicóloga.' },
  { url: '/pergunte', titulo: 'Pergunte à psicóloga', desc: 'Envio anônimo de dúvidas sobre relacionamentos.' },
  { url: '/diario', titulo: 'Diário anônimo', desc: 'Mural coletivo e anônimo de relatos do dia a dia.' },
  { url: '/biblioteca', titulo: 'Biblioteca dos relacionamentos', desc: 'Temas de comunicação, família, filhos e autoconhecimento.' },
  { url: '/exercicios', titulo: 'Exercícios e testes', desc: 'Testes rápidos de autoconhecimento sobre relacionamentos.' },
  { url: '/privacidade', titulo: 'Política de privacidade (LGPD)', desc: 'Como os dados pessoais são tratados.' },
  { url: '/termos', titulo: 'Termos de uso', desc: 'Regras de uso do site e dos espaços de envio.' },
];

const MENSAGENS = {
  casal: 'Olá, Natalie! Gostaria de informações sobre a Terapia de Casal.',
  individual: 'Olá, Natalie! Gostaria de informações sobre a Terapia Individual.',
  duvida: 'Olá, Natalie! Gostaria de tirar uma dúvida sobre o atendimento.',
};

export function textoInformacoes() {
  return [
    'Natalie Rodrigues Thedim Silvado (marca: Natalie Thedim), psicóloga clínica, CRP 05/45482 (Rio de Janeiro).',
    'Especialidade: Terapia de Casal e Família. Abordagem sistêmica e psicanálise. Mais de 20 anos de experiência. Formação PUC-Rio (Psicologia e Pedagogia; pós-graduação em Casal e Família).',
    'Atendimentos: Terapia de Casal; Terapia Individual (adultos e adolescentes).',
    'Onde: consultório no Jardim Botânico, Zona Sul do Rio de Janeiro (RJ), e online para todo o Brasil e exterior.',
    'Valores: não são divulgados no site (Código de Ética do Psicólogo); são informados no primeiro contato.',
    `Agendamento: WhatsApp +55 21 98902-0364 (https://wa.me/${WHATSAPP}) ou e-mail ${EMAIL}.`,
    'Este canal não é para urgências: em risco de vida, ligue 188 (CVV) ou 192 (SAMU).',
    `Site: ${BASE}/ . Política de privacidade: ${BASE}/privacidade . Termos de uso: ${BASE}/termos .`,
  ].join('\n');
}

export function textoAgendar(motivo) {
  const chave = MENSAGENS[motivo] ? motivo : 'duvida';
  const link = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(MENSAGENS[chave])}`;
  return [
    'O agendamento é feito por conversa no WhatsApp; esta ferramenta não envia mensagem nem reserva horário.',
    `Link para a pessoa abrir a conversa (mensagem pré-pronta): ${link}`,
    `Alternativas: e-mail ${EMAIL}; agenda online: https://www.doctoralia.com.br/perfil/natalie-rodrigues-thedim-silvado`,
    'Valores e horários são combinados no primeiro contato.',
  ].join('\n');
}

export function textoPaginas() {
  return PAGINAS.map((p) => `- ${BASE}${p.url}: ${p.titulo}. ${p.desc}`).join('\n');
}

const FERRAMENTAS = [
  {
    name: 'informacoes_atendimento',
    description: 'Resumo público sobre a psicóloga Natalie Thedim: registro (CRP), especialidade, modalidades, local, canais de contato e aviso de urgência.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: () => textoInformacoes(),
  },
  {
    name: 'como_agendar',
    description: 'Devolve o link do WhatsApp (com mensagem pré-pronta) e os demais canais para a pessoa agendar a primeira conversa. Não envia mensagem nem reserva horário.',
    inputSchema: {
      type: 'object',
      properties: { motivo: { type: 'string', enum: ['casal', 'individual', 'duvida'], description: 'Tipo de atendimento ou dúvida.' } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (args) => textoAgendar(args && args.motivo),
  },
  {
    name: 'listar_paginas',
    description: 'Lista as páginas públicas do site com título e descrição curta.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: () => textoPaginas(),
  },
];

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const erro = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

// Trata UMA mensagem JSON-RPC. Retorna null para notificações (sem resposta).
function tratar(msg) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return erro(msg && msg.id, -32600, 'Requisição inválida');
  }
  const { id, method, params } = msg;
  const ehNotificacao = id === undefined || id === null;
  if (method.startsWith('notifications/')) return null;

  switch (method) {
    case 'initialize': {
      const pedido = params && params.protocolVersion;
      return ok(id, {
        protocolVersion: PROTOCOLOS.includes(pedido) ? pedido : PROTOCOLOS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: 'Servidor somente leitura com informações públicas do consultório. Para agendar, entregue ao usuário o link do WhatsApp devolvido por como_agendar.',
      });
    }
    case 'ping':
      return ehNotificacao ? null : ok(id, {});
    case 'tools/list':
      return ok(id, { tools: FERRAMENTAS.map(({ run, ...pub }) => pub) });
    case 'tools/call': {
      const nome = params && params.name;
      const f = FERRAMENTAS.find((x) => x.name === nome);
      if (!f) return erro(id, -32602, `Ferramenta desconhecida: ${String(nome).slice(0, 60)}`);
      return ok(id, { content: [{ type: 'text', text: f.run(params.arguments || {}) }], isError: false });
    }
    default:
      return ehNotificacao ? null : erro(id, -32601, 'Método não suportado');
  }
}

// Retorna { status, body } — body é objeto/array JSON ou null (202 sem corpo).
export function tratarMcp(corpo) {
  if (Array.isArray(corpo)) {
    if (corpo.length === 0 || corpo.length > 20) return { status: 400, body: erro(null, -32600, 'Lote inválido') };
    const respostas = corpo.map(tratar).filter(Boolean);
    return respostas.length ? { status: 200, body: respostas } : { status: 202, body: null };
  }
  const r = tratar(corpo);
  return r ? { status: 200, body: r } : { status: 202, body: null };
}

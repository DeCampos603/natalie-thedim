/* ---------------------------------------------------------------------------
   WebMCP: ferramentas para agentes que rodam no navegador (navigator.modelContext).
   - Só registra se o navegador oferecer a API; caso contrário não faz nada.
   - Somente informação pública e navegação. Nenhuma ferramenta envia dados, agenda ou
     abre o WhatsApp sozinha: devolvem o link para a PESSOA decidir abrir.
   - Manter em sincronia com api/_agente.js (versão do servidor MCP) e llms.txt.
   --------------------------------------------------------------------------- */
(function () {
  'use strict';
  var mc = navigator.modelContext;
  if (!mc || typeof mc.registerTool !== 'function') return;

  var WA = '5521989020364';
  var MENSAGENS = {
    casal: 'Olá, Natalie! Gostaria de informações sobre a Terapia de Casal.',
    individual: 'Olá, Natalie! Gostaria de informações sobre a Terapia Individual.',
    duvida: 'Olá, Natalie! Gostaria de tirar uma dúvida sobre o atendimento.'
  };
  var PAGINAS = {
    inicio: '/', sobre: '/sobre', contato: '/contato', historias: '/historias', cartas: '/cartas',
    pergunte: '/pergunte', diario: '/diario', biblioteca: '/biblioteca', exercicios: '/exercicios',
    privacidade: '/privacidade', termos: '/termos'
  };

  function texto(t) { return { content: [{ type: 'text', text: t }] }; }

  var ferramentas = [
    {
      name: 'informacoes_atendimento',
      description: 'Resumo público sobre a psicóloga Natalie Thedim: CRP, especialidade, modalidades, local e canais de contato.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: function () {
        return Promise.resolve(texto([
          'Natalie Thedim, psicóloga clínica, CRP 05/45482 (Rio de Janeiro). Especialista em Terapia de Casal e Família, mais de 20 anos de experiência, formação PUC-Rio.',
          'Atendimentos: Terapia de Casal; Terapia Individual (adultos e adolescentes).',
          'Onde: Jardim Botânico, Zona Sul do Rio de Janeiro (RJ), e online para todo o Brasil e exterior.',
          'Valores não são divulgados no site; são informados no primeiro contato.',
          'Agendamento: WhatsApp +55 21 98902-0364 ou psicologa@nataliethedim.com.br.',
          'Não é canal de urgência: em risco de vida, ligue 188 (CVV) ou 192 (SAMU).'
        ].join('\n')));
      }
    },
    {
      name: 'como_agendar',
      description: 'Devolve o link do WhatsApp com mensagem pré-pronta para a pessoa iniciar o agendamento. Não envia mensagem nem reserva horário.',
      inputSchema: {
        type: 'object',
        properties: { motivo: { type: 'string', enum: ['casal', 'individual', 'duvida'], description: 'Tipo de atendimento ou dúvida.' } },
        additionalProperties: false
      },
      annotations: { readOnlyHint: true },
      execute: function (args) {
        var m = args && MENSAGENS[args.motivo] ? args.motivo : 'duvida';
        var link = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(MENSAGENS[m]);
        return Promise.resolve(texto('Link para a pessoa abrir a conversa no WhatsApp: ' + link +
          '\nValores e horários são combinados no primeiro contato.'));
      }
    },
    {
      name: 'ir_para_pagina',
      description: 'Navega para uma página pública do site (somente leitura).',
      inputSchema: {
        type: 'object',
        properties: { pagina: { type: 'string', enum: Object.keys(PAGINAS), description: 'Página de destino.' } },
        required: ['pagina'],
        additionalProperties: false
      },
      execute: function (args) {
        var destino = args && PAGINAS[args.pagina];
        if (!destino) return Promise.resolve(texto('Página desconhecida.'));
        window.location.assign(destino);
        return Promise.resolve(texto('Abrindo ' + destino));
      }
    }
  ];

  ferramentas.forEach(function (f) {
    try { mc.registerTool(f); } catch (e) { /* já registrada ou API incompleta */ }
  });
})();

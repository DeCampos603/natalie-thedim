/* ---------------------------------------------------------------------------
   CONFIGURAÇÃO DE MEDIÇÃO E GOOGLE ADS (preencher quando as contas existirem)
   ---------------------------------------------------------------------------
   Enquanto TODOS os campos estiverem vazios, o site NÃO carrega nenhum script
   do Google, NÃO grava cookie de medição e NÃO mostra o aviso de cookies.

   ga4Id          ID de métricas do Google Analytics 4        ex.: "G-XXXXXXXXXX"
   adsId          ID da conta do Google Ads (tag de conversão) ex.: "AW-123456789"
   adsWhatsappLabel  rótulo da conversão "Clique no WhatsApp"  ex.: "AbCdEfGhIjKl"
                  (Google Ads > Metas > Conversões > Site > rótulo do evento)
   gtmId          alternativa: ID do Google Tag Manager         ex.: "GTM-XXXXXXX"
                  (se usar o GTM, deixe ga4Id/adsId vazios e configure lá)
   --------------------------------------------------------------------------- */
window.SITE_ANALYTICS = {
  ga4Id: '',
  adsId: '',
  adsWhatsappLabel: '',
  gtmId: ''
};

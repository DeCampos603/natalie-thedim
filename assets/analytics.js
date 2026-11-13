/* ---------------------------------------------------------------------------
   Medição + Google Ads com consentimento prévio (LGPD) — modo "básico"
   - Nada é carregado sem ID configurado em analytics-config.js.
   - Com ID configurado: NENHUM script do Google é baixado e NENHUM sinal é
     enviado ao Google antes de a pessoa clicar em "Aceitar". Se recusar (ou não
     responder), o site funciona igual e nada é medido.
   - Depois do aceite: o consentimento é declarado como concedido (Consent Mode
     v2), as tags carregam e o clique em links wa.me vira evento/conversão.
   - A escolha fica salva neste navegador. Esta medição não é carregada nas
     páginas clínicas (ex.: raizes.html).
   --------------------------------------------------------------------------- */
(function () {
  'use strict';
  var cfg = window.SITE_ANALYTICS || {};
  var temGtm = !!cfg.gtmId;
  var temGtag = !!(cfg.ga4Id || cfg.adsId);
  if (!temGtm && !temGtag) return; // nada configurado: não faz nada

  var CHAVE = 'nt_consent_v1';
  var CONCEDIDO = {
    ad_storage: 'granted', analytics_storage: 'granted',
    ad_user_data: 'granted', ad_personalization: 'granted'
  };
  var NEGADO = {
    ad_storage: 'denied', analytics_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied'
  };

  function lerEscolha() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function gravarEscolha(v) {
    try { localStorage.setItem(CHAVE, v); } catch (e) { /* navegação privada */ }
  }

  var iniciado = false;
  function gtag() { window.dataLayer.push(arguments); }

  // Só roda depois do aceite: declara o consentimento e carrega as tags.
  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || gtag;
    gtag('consent', 'default', NEGADO);
    gtag('consent', 'update', CONCEDIDO);

    var s = document.createElement('script');
    s.async = true;
    if (temGtm) {
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(cfg.gtmId);
    } else {
      gtag('js', new Date());
      if (cfg.ga4Id) gtag('config', cfg.ga4Id, { anonymize_ip: true });
      if (cfg.adsId) gtag('config', cfg.adsId);
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.ga4Id || cfg.adsId);
    }
    document.head.appendChild(s);
  }

  // Conversão: clique em qualquer link para o WhatsApp (só com consentimento).
  document.addEventListener('click', function (ev) {
    if (!iniciado) return;
    var a = ev.target.closest && ev.target.closest('a[href*="wa.me/"]');
    if (!a) return;
    var pagina = location.pathname.replace(/\/$/, '') || '/';
    if (temGtm) {
      window.dataLayer.push({ event: 'whatsapp_click', pagina: pagina });
      return;
    }
    gtag('event', 'whatsapp_click', { pagina: pagina, event_category: 'contato' });
    if (cfg.adsId && cfg.adsWhatsappLabel) {
      gtag('event', 'conversion', { send_to: cfg.adsId + '/' + cfg.adsWhatsappLabel });
    }
  }, true);

  var escolha = lerEscolha();
  if (escolha === 'aceito') { iniciar(); return; }
  if (escolha === 'recusado') return;

  // Aviso de cookies (só quando há medição configurada e ainda não houve escolha).
  function montarAviso() {
    var box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Aviso de cookies');
    box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;max-width:560px;margin:0 auto;' +
      'z-index:9999;background:#fff;color:#2C1E21;border:1px solid #E6D2CE;border-radius:14px;' +
      'box-shadow:0 12px 40px rgba(64,15,26,.18);padding:16px 18px;font:400 14px/1.5 "Plus Jakarta Sans",system-ui,sans-serif;';
    box.innerHTML =
      '<p style="margin:0 0 12px">Uso cookies de medição para entender como o site é encontrado e melhorar o atendimento. ' +
      'Nada é medido sem a sua permissão, e o site funciona normalmente nas duas opções. ' +
      '<a href="privacidade.html" style="color:#5B1826;text-decoration:underline">Política de privacidade</a>.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button type="button" data-nt="recusado" style="flex:1;min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid #5B1826;background:#fff;color:#5B1826;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer">Recusar</button>' +
      '<button type="button" data-nt="aceito" style="flex:1;min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid #5B1826;background:#5B1826;color:#fff;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer">Aceitar</button>' +
      '</div>';
    box.addEventListener('click', function (e) {
      var v = e.target && e.target.getAttribute && e.target.getAttribute('data-nt');
      if (!v) return;
      gravarEscolha(v);
      if (v === 'aceito') iniciar();
      box.remove();
    });
    document.body.appendChild(box);
  }
  if (document.body) montarAviso();
  else document.addEventListener('DOMContentLoaded', montarAviso);
})();

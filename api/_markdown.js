// Converte o HTML de uma página do site em Markdown para agentes (Accept: text/markdown).
// Sem dependências. Descarta navegação, rodapé, scripts, formulários e botões; mantém títulos,
// parágrafos, listas, links e ênfase do conteúdo principal (<main>).

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', ndash: '–', mdash: '—', rarr: '→', larr: '←' };

function decodificar(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENTIDADES[n.toLowerCase()] ?? m));
}

function absoluto(href, base) {
  try { return new URL(href, base).href; } catch { return href; }
}

export function htmlParaMarkdown(html, urlPagina) {
  const titulo = decodificar((html.match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1]).trim();
  const desc = decodificar((html.match(/<meta name="description" content="([^"]*)"/i) || [, ''])[1]).trim();

  let corpo = (html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<body[\s\S]*?<\/body>/i) || [html])[0];
  corpo = corpo
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg|noscript|template|form|button|nav|header|footer|select|textarea|iframe)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(section|div|p|span|li)\b[^>]*\shidden(?=[\s>=])[^>]*>[\s\S]*?<\/\1>/gi, '');

  corpo = corpo
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, (_, alt) => (alt.trim() ? ` ![${alt.trim()}] ` : ''))
    .replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
      const texto = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!texto || href.startsWith('#') || /^javascript:/i.test(href)) return texto;
      return `[${texto}](${absoluto(href, urlPagina)})`;
    })
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) =>
      `\n\n${'#'.repeat(Number(n))} ${t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n\n`)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|ul|ol|blockquote|figure|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ');

  corpo = decodificar(corpo)
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const cab = [`# ${titulo}`, desc ? `> ${desc}` : '', `Fonte: ${urlPagina}`].filter(Boolean).join('\n\n');
  return `${cab}\n\n---\n\n${corpo}\n`;
}

// Escolhe markdown quando o cliente o prefere ao HTML (ex.: "text/markdown, text/html;q=0.9").
export function prefereMarkdown(accept) {
  if (!accept) return false;
  let qmd = 0;
  let qhtml = 0;
  for (const parte of String(accept).split(',')) {
    const [tipo, ...params] = parte.trim().toLowerCase().split(';');
    const q = (params.map((p) => p.trim()).find((p) => p.startsWith('q=')) || 'q=1').slice(2);
    const val = Number.isFinite(Number(q)) ? Number(q) : 1;
    if (tipo === 'text/markdown') qmd = Math.max(qmd, val);
    if (tipo === 'text/html') qhtml = Math.max(qhtml, val);
  }
  return qmd > 0 && qmd >= qhtml;
}

// Endpoint de Notificação por E-mail Oficial (Hostinger SMTP + Fallback)
// Dispara alertas para psicologa@nataliethedim.com.br
import nodemailer from 'nodemailer';
import { responder, lerBody, escHtml, EMAIL_RE, consumirLimite } from './_lib.js';

let transporterInstance = null;

function obterTransporter() {
  if (transporterInstance) return transporterInstance;

  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER || 'psicologa@nataliethedim.com.br';
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (!pass) {
    return null; // Fallback ativo
  }

  transporterInstance = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return transporterInstance;
}

export async function enviarEmailNotificacao({ tipo, remetente, email, assunto, mensagem, dadosExtras = {} }) {
  const tipoLimpo = String(tipo || 'Aviso do Site').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
  const remetenteLimpo = String(remetente || 'Anônimo / Leitor').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
  const emailLimpo = String(email || '').replace(/[\r\n]+/g, '').trim().slice(0, 160);
  const msgLimpa = String(mensagem || '').trim().slice(0, 5000);
  const assuntoLimpo = String(assunto || `[Site Natalie Thedim] Novo(a) ${tipoLimpo}`)
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 160);

  const emailDestino = process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL || 'psicologa@nataliethedim.com.br';
  const extrasEntries = (dadosExtras && typeof dadosExtras === 'object' && !Array.isArray(dadosExtras))
    ? Object.entries(dadosExtras).slice(0, 15)
    : [];

  const htmlEmail = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #FAF4F2; color: #2C2627; margin: 0; padding: 20px; }
.container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; border: 1px solid #E6D2CE; overflow: hidden; box-shadow: 0 4px 12px rgba(91,24,38,0.06); }
.header { background: #5B1826; padding: 24px; text-align: center; color: #FFFFFF; }
.header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.02em; }
.header p { margin: 4px 0 0; font-size: 13px; color: #EAD0D6; }
.badge { display: inline-block; background: #FAF4F2; color: #5B1826; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 12px; text-transform: uppercase; }
.content { padding: 24px; }
.info-box { background: #FAF4F2; border-left: 4px solid #5B1826; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 4px 4px 0; }
.info-box p { margin: 4px 0; font-size: 14px; }
.mensagem-box { background: #FFFFFF; border: 1px solid #E6D2CE; padding: 16px; border-radius: 6px; font-size: 15px; line-height: 1.6; color: #111; white-space: pre-wrap; margin-bottom: 20px; }
.footer { background: #FAF4F2; padding: 16px 24px; font-size: 12px; color: #7A6F71; text-align: center; border-top: 1px solid #E6D2CE; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>Natalie Thedim · Notificação Oficial</h1>
      <p>Plataforma Digital &amp; Consultório Clínico</p>
      <div class="badge">${escHtml(tipoLimpo)}</div>
    </div>
    <div class="content">
      <div class="info-box">
        <p><strong>Remetente:</strong> ${escHtml(remetenteLimpo)}</p>
        <p><strong>E-mail de Contato:</strong> ${escHtml(emailLimpo || '(Não informado)')}</p>
        <p><strong>Data de Recebimento:</strong> ${escHtml(new Date().toLocaleString('pt-BR'))}</p>
        ${extrasEntries.map(([k, v]) => `<p><strong>${escHtml(String(k).slice(0, 60))}:</strong> ${escHtml(String(v ?? '').slice(0, 300))}</p>`).join('')}
      </div>
      <h3 style="color:#5B1826; font-size:16px; margin-top:0;">Conteúdo da Mensagem:</h3>
      <div class="mensagem-box">${escHtml(msgLimpa || '(Sem mensagem detalhada)')}</div>
      <p style="font-size:13px; color:#555;">Você pode gerenciar os envios no Painel Administrativo em <a href="https://nataliethedim.com.br/admin.html" style="color:#5B1826; font-weight:600;">nataliethedim.com.br/admin.html</a>.</p>
    </div>
    <div class="footer">
      Natalie Thedim Silvado Camardella · CRP 05/45482<br>
      Material confidencial protegido pelo Código de Ética do Psicólogo e pela LGPD.
    </div>
  </div>
</body>
</html>`;

  const transporter = obterTransporter();
  if (!transporter) {
    console.warn('[notificar] Variável SMTP_PASS ausente no ambiente. Ativando fallback silencioso.');
    return {
      ok: true,
      enviado: false,
      aviso: 'SMTP não configurado no ambiente.',
      provedor: 'fallback'
    };
  }

  await transporter.sendMail({
    from: `"Site Natalie Thedim" <${process.env.SMTP_USER || 'psicologa@nataliethedim.com.br'}>`,
    to: emailDestino,
    replyTo: EMAIL_RE.test(emailLimpo) ? emailLimpo : undefined,
    subject: assuntoLimpo,
    html: htmlEmail,
    text: `Nova notificação do site:\n\nTipo: ${tipoLimpo}\nDe: ${remetenteLimpo} (${emailLimpo || 'não informado'})\n\nMensagem:\n${msgLimpa}`
  });

  console.log(`[notificar] E-mail enviado com sucesso via SMTP Hostinger para ${emailDestino}`);
  return { ok: true, enviado: true, provedor: 'hostinger_smtp' };
}

export default async function handler(req, res) {
  if (typeof res.setHeader === 'function') res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return responder(res, 405, { ok: false, erro: 'Método não permitido.' });
  }

  try {
    const limite = await consumirLimite(req, 600, 5);
    if (limite.bloqueado) {
      return responder(res, 429, { ok: false, erro: 'Muitas notificações em pouco tempo. Aguarde alguns minutos.' });
    }

    const body = lerBody(req);
    const mensagem = String(body.mensagem || '').trim();
    if (!body.tipo && !mensagem) {
      return responder(res, 400, { ok: false, erro: 'Dados insuficientes para notificação.' });
    }

    const resultado = await enviarEmailNotificacao(body);
    return responder(res, 200, resultado);
  } catch (err) {
    console.error('[notificar] Erro ao disparar e-mail:', err);
    return responder(res, 500, { ok: false, erro: 'Falha temporária ao processar notificação por e-mail.' });
  }
}

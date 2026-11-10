// Endpoint de Notificação por E-mail Oficial (Hostinger SMTP + Fallback)
// Dispara alertas para psicologa@nataliethedim.com.br
import nodemailer from 'nodemailer';
import { responder, lerBody, ipHash } from './_lib.js';

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
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    }
  });

  return transporterInstance;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return responder(res, 405, { erro: 'Método não permitido.' });
  }

  try {
    const body = lerBody(req);
    const { tipo, remetente, email, mensagem, dadosExtras = {} } = body;

    const emailDestino = process.env.ADMIN_EMAIL || 'psicologa@nataliethedim.com.br';
    const assunto = body.assunto || `[Site Natalie Thedim] Novo(a) ${tipo || 'Interação de Leitor'}`;

    // Monta o template de e-mail institucional na paleta Marsala/Rosé
    const htmlEmail = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Natalie Thedim · Notificação Oficial</h1>
            <p>Plataforma Digital & Consultório Clínico</p>
            <div class="badge">${tipo || 'Aviso do Site'}</div>
          </div>
          <div class="content">
            <div class="info-box">
              <p><strong>Remetente:</strong> ${remetente || 'Anônimo / Leitor'}</p>
              <p><strong>E-mail de Contato:</strong> ${email || '(Não informado)'}</p>
              <p><strong>Data de Recebimento:</strong> ${new Date().toLocaleString('pt-BR')}</p>
              ${dadosExtras && Object.keys(dadosExtras).length ? Object.entries(dadosExtras).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('') : ''}
            </div>

            <h3 style="color:#5B1826; font-size:16px; margin-top:0;">Conteúdo da Mensagem:</h3>
            <div class="mensagem-box">${mensagem || '(Sem mensagem detalhada)'}</div>

            <p style="font-size:13px; color:#555;">Você pode responder diretamente ao remetente clicando em Responder ou gerenciar este conteúdo no seu Painel Administrativo em <a href="https://nataliethedim.com.br/admin.html" style="color:#5B1826; font-weight:600;">nataliethedim.com.br/admin.html</a>.</p>
          </div>
          <div class="footer">
            Natalie Thedim Silvado Camardella · CRP 05/45482<br>
            Material confidencial protegido pelo Código de Ética do Psicólogo e pela LGPD.
          </div>
        </div>
      </body>
      </html>
    `;

    const transporter = obterTransporter();

    if (transporter) {
      await transporter.sendMail({
        from: `"Site Natalie Thedim" <${process.env.SMTP_USER || 'psicologa@nataliethedim.com.br'}>`,
        to: emailDestino,
        replyTo: email && email.includes('@') ? email : undefined,
        subject: assunto,
        html: htmlEmail,
        text: `Nova notificação do site:\n\nTipo: ${tipo}\nDe: ${remetente} (${email})\n\nMensagem:\n${mensagem}`
      });
      console.log(`[notificar] E-mail enviado com sucesso via SMTP Hostinger para ${emailDestino}`);
      return responder(res, 200, { ok: true, enviado: true, provedor: 'hostinger_smtp' });
    }

    // Se SMTP_PASS não estiver definida, registra e avisa
    console.warn('[notificar] Variável SMTP_PASS ausente no ambiente. Ativando fallback silencioso.');
    return responder(res, 200, { 
      ok: true, 
      enviado: false, 
      aviso: 'SMTP_PASS não configurada. Configure no hPanel para envio nativo.',
      provedor: 'fallback' 
    });
  } catch (err) {
    console.error('[notificar] Erro ao disparar e-mail:', err);
    return responder(res, 500, { erro: 'Falha no envio de e-mail.', detalhe: err.message });
  }
}

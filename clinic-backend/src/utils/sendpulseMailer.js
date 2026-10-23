const SEND_TIMEOUT_MS = 15000;
const DEFAULT_ENDPOINT = 'https://api.sendpulse.com/smtp/emails';

let missingConfigWarned = false;

const isEnabled = () => String(process.env.MAIL_ENABLED || 'true').toLowerCase() !== 'false';

const getConfig = () => ({
  apiKey: process.env.MAIL_API,
  endpoint: process.env.MAIL_SENDPULSE_ENDPOINT || DEFAULT_ENDPOINT,
  fromEmail: process.env.MAIL_FROM_EMAIL,
});

const sendMail = async ({ to, toName, subject, text, html, fromName, replyTo }) => {
  if (!isEnabled()) {
    return { sent: false, skipped: true, reason: 'MAIL_ENABLED is false' };
  }

  const { apiKey, endpoint, fromEmail } = getConfig();
  if (!apiKey || !fromEmail) {
    if (!missingConfigWarned) {
      missingConfigWarned = true;
      console.warn('Email notifications skipped: MAIL_API and MAIL_FROM_EMAIL must both be set.');
    }
    return { sent: false, skipped: true, reason: 'email is not configured' };
  }

  if (!to) {
    return { sent: false, skipped: true, reason: 'recipient email is missing' };
  }

  const payload = {
    email: {
      html: Buffer.from(html || '', 'utf8').toString('base64'),
      text: text || '',
      subject,
      from: {
        name: fromName || 'Clinic System',
        email: fromEmail,
      },
      to: [{ name: toName || to, email: to }],
    },
  };

  if (replyTo && replyTo.email) {
    payload.email.reply_to = {
      name: replyTo.name || replyTo.email,
      email: replyTo.email,
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok || (data && data.result === false)) {
      const detail = data && (data.message || data.error);
      const error = detail || `SendPulse responded with HTTP ${response.status}`;
      console.warn('Email notification failed:', error);
      return { sent: false, error };
    }

    return { sent: true, id: data && data.id };
  } catch (error) {
    console.warn('Email notification failed:', error.message);
    return { sent: false, error: error.message };
  }
};

module.exports = { sendMail };

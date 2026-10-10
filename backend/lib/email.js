const PRODUCT = 'TARAhut Haazri';
const SITE = 'https://haazri.tarahutaibuilds.com';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const firstName = (name) => (name ? String(name).split(' ')[0] : 'there');
const wrap = (inner) => `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#0f172a">${inner}</div>`;

/** Sends one email through Resend. Throws if it could not be sent. */
async function send({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      // The sender address has no mailbox; replies go to a real inbox.
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      to,
      subject,
      text,
      html,
    }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Resend failed: ${response.status} ${details.slice(0, 300)}`);
  }
}

export function sendOtpEmail({ to, name, code }) {
  const hi = firstName(name);
  return send({
    to,
    subject: `${code} is your ${PRODUCT} sign-in code`,
    text: `Hi ${hi},\n\nYour ${PRODUCT} sign-in code is ${code}. It expires in 5 minutes.\n\nIf you did not try to sign in, you can ignore this email.`,
    html: wrap(`
  <p>Hi ${escapeHtml(hi)},</p>
  <p>Your ${PRODUCT} sign-in code is:</p>
  <p style="font-size:28px;letter-spacing:6px;font-weight:700">${escapeHtml(code)}</p>
  <p>It expires in 5 minutes. If you did not try to sign in, you can ignore this email.</p>`),
  });
}

/** Tells a newly added person they have an account and how to get the app. */
export function sendWelcomeEmail({ to, name, phone, company, addedBy }) {
  const hi = firstName(name);
  const installUrl = `${SITE}/get`;
  const who = addedBy ? `${addedBy} has added you` : 'You have been added';
  return send({
    to,
    subject: `You've been added to ${company} on ${PRODUCT}`,
    text: [
      `Hi ${hi},`,
      '',
      `${who} to ${company} on ${PRODUCT}, the app your team uses to mark attendance.`,
      '',
      `1. Install the app: ${installUrl}`,
      `2. Open it and sign in with your phone number ${phone}.`,
      `3. We'll email a 4-digit code to this address. Enter it and you're in.`,
      '',
      'Questions? Just reply to this email.',
    ].join('\n'),
    html: wrap(`
  <p>Hi ${escapeHtml(hi)},</p>
  <p>${escapeHtml(who)} to <strong>${escapeHtml(company)}</strong> on ${PRODUCT}, the app your team uses to mark attendance.</p>
  <ol>
    <li><a href="${installUrl}">Install the app</a></li>
    <li>Open it and sign in with your phone number <strong>${escapeHtml(phone)}</strong>.</li>
    <li>We'll email a 4-digit code to this address. Enter it and you're in.</li>
  </ol>
  <p>Questions? Just reply to this email.</p>`),
  });
}

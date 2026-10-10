const PRODUCT = 'TARAhut Haazri';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Sends the sign-in code through Resend. Throws if it could not be sent. */
export async function sendOtpEmail({ to, name, code }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  const greeting = name ? name.split(' ')[0] : 'there';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      // The sender address has no mailbox; replies go to a real inbox.
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      to,
      subject: `${code} is your ${PRODUCT} sign-in code`,
      text: `Hi ${greeting},\n\nYour ${PRODUCT} sign-in code is ${code}. It expires in 5 minutes.\n\nIf you did not try to sign in, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#0f172a">
  <p>Hi ${escapeHtml(greeting)},</p>
  <p>Your ${PRODUCT} sign-in code is:</p>
  <p style="font-size:28px;letter-spacing:6px;font-weight:700">${escapeHtml(code)}</p>
  <p>It expires in 5 minutes. If you did not try to sign in, you can ignore this email.</p>
</div>`,
    }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Resend failed: ${response.status} ${details.slice(0, 300)}`);
  }
}

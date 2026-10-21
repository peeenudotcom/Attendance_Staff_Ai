// Sign-in codes over WhatsApp (Meta WhatsApp Business Platform, Cloud API).
// Set WHATSAPP_TOKEN (system-user token), WHATSAPP_PHONE_ID (the sending number's Phone number ID) and
// WHATSAPP_TEMPLATE (an approved Authentication template with a "Copy code" button). Leave any unset to turn it off.
const GRAPH = 'https://graph.facebook.com/v23.0';

export const whatsappEnabled = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TEMPLATE);

/** Sends `code` to an Indian 10-digit `phone` on WhatsApp. Throws if Meta does not accept it. */
export function sendOtpWhatsApp({ phone, code }) {
  return sendTemplate({
    phone,
    template: process.env.WHATSAPP_TEMPLATE,
    components: [
      { type: 'body', parameters: [{ type: 'text', text: code }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
    ],
  });
}

/** Daily summary messages need their own approved template (Utility), set in WHATSAPP_SUMMARY_TEMPLATE. */
export const summaryEnabled = () => whatsappEnabled() && Boolean(process.env.WHATSAPP_SUMMARY_TEMPLATE);

/** Sends the daily attendance summary; `values` fill the template's {{1}}…{{6}} in order. */
export function sendSummaryWhatsApp({ phone, values }) {
  return sendTemplate({
    phone,
    template: process.env.WHATSAPP_SUMMARY_TEMPLATE,
    components: [{ type: 'body', parameters: values.map((v) => ({ type: 'text', text: String(v) })) }],
  });
}

async function sendTemplate({ phone, template, components }) {
  const response = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: `91${phone}`,
      type: 'template',
      template: { name: template, language: { code: process.env.WHATSAPP_LANGUAGE || 'en' }, components },
    }),
  });
  const details = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`WhatsApp failed: ${response.status} ${details.slice(0, 300)}`);
  // Accepted is not delivered: delivery (or failure) is reported later to /api/whatsapp/webhook.
  let sent = {};
  try { sent = JSON.parse(details); } catch { /* keep going */ }
  console.log(`[whatsapp] ${template} accepted id=${sent.messages?.[0]?.id ?? '?'} status=${sent.messages?.[0]?.message_status ?? '?'} wa_id=${sent.contacts?.[0]?.wa_id ?? '?'} to=${maskPhone(phone)}`);
}

export const maskPhone = (phone) => `+91 ******${String(phone).slice(-4)}`;

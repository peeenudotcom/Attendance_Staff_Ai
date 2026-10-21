// Meta calls this with WhatsApp delivery updates (sent / delivered / read / failed).
// Set it up in the Meta app: WhatsApp -> Configuration -> Webhook, callback URL
// https://haazri.tarahutaibuilds.com/api/whatsapp/webhook, verify token = WHATSAPP_VERIFY_TOKEN,
// then subscribe to the "messages" field. It only writes to the server log and acts on nothing,
// so events are not signature-checked.
const mask = (n) => (n ? `******${String(n).slice(-4)}` : '?');

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const q = req.query || {};
    const token = process.env.WHATSAPP_VERIFY_TOKEN;
    if (token && q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === token) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(String(q['hub.challenge'] ?? ''));
    }
    return res.status(403).send('Forbidden');
  }
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  let payload = req.body;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = {}; } }
  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        const errors = (s.errors ?? []).map((e) => `${e.code} ${e.title}${e.error_data?.details ? `: ${e.error_data.details}` : ''}`).join('; ');
        const line = `[whatsapp webhook] id=${s.id} status=${s.status} to=${mask(s.recipient_id)}${errors ? ` error=${errors}` : ''}`;
        if (s.status === 'failed') console.error(line); else console.log(line);
      }
    }
  }
  return res.status(200).send('OK');
}

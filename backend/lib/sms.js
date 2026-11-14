// Server-only SMS transport. Haazri remains responsible for code generation,
// expiry, attempts and consumption; MSG91 only delivers that same code.
export const smsEnabled = () => Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID);

export async function sendOtpSms({ phone, code }) {
  if (!smsEnabled()) throw new Error('SMS is not configured');
  if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4}$/.test(code)) throw new Error('Invalid SMS destination or code');
  const url = new URL('https://control.msg91.com/api/v5/otp');
  url.search = new URLSearchParams({
    template_id: process.env.MSG91_OTP_TEMPLATE_ID,
    mobile: `91${phone}`,
    otp: code,
    otp_length: '4',
    otp_expiry: '5',
  }).toString();
  // Do not log the request URL, auth key, OTP or provider response body.
  const response = await fetch(url, {
    method: 'POST',
    headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('SMS provider refused the request');
  const result = await response.json();
  if (result?.type !== 'success') throw new Error('SMS provider did not accept the request');
}

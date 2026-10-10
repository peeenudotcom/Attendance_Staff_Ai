// Catches the email typos people make on phone keyboards, so a code or welcome email
// isn't sent to an address that cannot exist.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DOMAIN_FIXES = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com', 'gmail.in': 'gmail.com', 'yaho.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'hotmal.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.co': 'outlook.com',
};
const TLD_FIXES = { con: 'com', cmo: 'com', comm: 'com', ocm: 'com', vom: 'com', xom: 'com' };

/** Returns an error message for an unusable email, or null if it looks fine. */
export function emailProblem(email) {
  if (!email || !EMAIL.test(email)) return 'Enter a valid email. Sign-in codes are sent there.';
  const [local, domain] = email.split('@');
  let fixed = DOMAIN_FIXES[domain];
  if (!fixed) {
    const parts = domain.split('.');
    const tld = parts.pop();
    if (TLD_FIXES[tld]) fixed = [...parts, TLD_FIXES[tld]].join('.');
  }
  return fixed ? `Check the email: did you mean ${local}@${fixed}?` : null;
}

import crypto from 'node:crypto';

/* Verifying a Google ID token.
 *
 * Kept apart from the server, and given its keys rather than fetching them, so
 * the checks below can be tested directly — the interesting cases are all
 * forged tokens, and a test needs to be able to forge them.
 */

function b64url(part) {
  return Buffer.from(String(part).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * @param {string} credential  the ID token from Google Identity Services
 * @param {object} opts        { keys: JWK[], clientId: string, now?: seconds }
 * @returns {object} the verified claims
 * @throws  Error whose message names the check that failed
 */
export function verifyGoogleToken(credential, opts) {
  const keys = (opts && opts.keys) || [];
  const clientId = (opts && opts.clientId) || '';
  const now = (opts && opts.now) || Math.floor(Date.now() / 1000);

  const parts = String(credential || '').split('.');
  if (parts.length !== 3) throw new Error('malformed');

  let header, payload;
  try {
    header = JSON.parse(b64url(parts[0]).toString('utf8'));
    payload = JSON.parse(b64url(parts[1]).toString('utf8'));
  } catch { throw new Error('malformed'); }

  // "alg":"none", and HMAC signed with the public key, are the two classic JWT
  // forgeries. Naming the algorithm we accept closes both.
  if (header.alg !== 'RS256') throw new Error('bad_algorithm');

  const jwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
  if (!jwk) throw new Error('unknown_key');

  let pub;
  try { pub = crypto.createPublicKey({ key: jwk, format: 'jwk' }); }
  catch { throw new Error('unknown_key'); }

  const signed = Buffer.from(`${parts[0]}.${parts[1]}`, 'ascii');
  if (!crypto.verify('RSA-SHA256', signed, pub, b64url(parts[2]))) throw new Error('bad_signature');

  if (!(Number(payload.exp) > now)) throw new Error('expired');
  if (Number(payload.iat) > now + 300) throw new Error('issued_in_future');
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
    throw new Error('bad_issuer');
  }
  // Without this, a valid Google token minted for any other site would work here.
  if (!clientId || payload.aud !== clientId) throw new Error('bad_audience');
  if (!payload.email) throw new Error('no_email');
  if (payload.email_verified === false || payload.email_verified === 'false') {
    throw new Error('email_unverified');
  }
  return payload;
}

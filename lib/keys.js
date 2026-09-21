import crypto from 'node:crypto';

/**
 * Licence keys are self-describing and stateless: everything needed to check a
 * key is inside the key itself, signed with KEY_SECRET. No database, so a
 * redeploy that wipes the filesystem cannot lose a customer's licence.
 *
 * Layout — 60 bits, rendered as 12 Crockford base32 characters:
 *
 *   [ 4 bits tier ][ 24 bits serial ][ 32 bits truncated HMAC-SHA256 ]
 *
 * Printed as WW-XXXX-XXXX-XXXX. Forging one without the secret means guessing
 * a 32-bit tag, which the activation rate limiter makes hopeless.
 */

// Crockford base32: no I, L, O or U, so keys survive being read aloud or
// copied off a receipt by hand.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DECODE = new Map([...ALPHABET].map((c, i) => [c, i]));
// The characters people actually type instead of the ones we use.
const CONFUSABLES = { I: '1', L: '1', O: '0', U: 'V' };

const TIER_BITS = 4n;
const SERIAL_BITS = 24n;
const MAC_BITS = 32n;
const MAC_MASK = (1n << MAC_BITS) - 1n;
const SERIAL_MASK = (1n << SERIAL_BITS) - 1n;
const TIER_MASK = (1n << TIER_BITS) - 1n;
const KEY_CHARS = 12;

export const TIERS = {
  0: { id: 'personal', name: 'Personal', maxPages: 20, commercial: false },
  1: { id: 'family', name: 'Family', maxPages: 40, commercial: false },
  2: { id: 'teacher', name: 'Teacher', maxPages: 100, commercial: true },
  3: { id: 'studio', name: 'Studio', maxPages: 0, commercial: true } // 0 = unlimited
};

export function tierByName(name) {
  const entry = Object.entries(TIERS).find(([, t]) => t.id === String(name).toLowerCase());
  if (!entry) throw new Error(`Unknown tier "${name}". Use one of: ${Object.values(TIERS).map((t) => t.id).join(', ')}`);
  return Number(entry[0]);
}

function mac(secret, tier, serial) {
  const h = crypto.createHmac('sha256', secret);
  h.update(`ww1:${tier}:${serial}`);
  return BigInt('0x' + h.digest('hex').slice(0, 8)) & MAC_MASK;
}

/**
 * Without this, serial 1 renders as WW-0000-… — which tells the customer
 * holding it that they are buyer number one, and makes consecutive keys look
 * like consecutive keys. A 4-round Feistel network over the 60 bits shuffles
 * them into something that reads as random while staying exactly reversible.
 */
const HALF_BITS = 30n;
const HALF_MASK = (1n << HALF_BITS) - 1n;
const ROUNDS = 4;

function roundFn(secret, round, half) {
  const h = crypto.createHmac('sha256', secret);
  h.update(`ww1-feistel:${round}:${half}`);
  return BigInt('0x' + h.digest('hex').slice(0, 10)) & HALF_MASK;
}

function scramble(secret, value) {
  let L = (value >> HALF_BITS) & HALF_MASK;
  let R = value & HALF_MASK;
  for (let r = 0; r < ROUNDS; r++) {
    const next = L ^ roundFn(secret, r, R);
    L = R;
    R = next;
  }
  return (L << HALF_BITS) | R;
}

function unscramble(secret, value) {
  let L = (value >> HALF_BITS) & HALF_MASK;
  let R = value & HALF_MASK;
  for (let r = ROUNDS - 1; r >= 0; r--) {
    const prev = R ^ roundFn(secret, r, L);
    R = L;
    L = prev;
  }
  return (L << HALF_BITS) | R;
}

function encode(value) {
  let out = '';
  for (let i = KEY_CHARS - 1; i >= 0; i--) {
    out += ALPHABET[Number((value >> (5n * BigInt(i))) & 31n)];
  }
  return out;
}

function format(body) {
  return `WW-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

/** Build one key. `serial` must be unique per tier — that is what the CLI tracks. */
export function mint(secret, tier, serial) {
  if (!secret) throw new Error('KEY_SECRET is required to mint keys');
  if (tier < 0 || tier > 15) throw new Error('tier must be 0-15');
  if (serial < 0 || serial > Number(SERIAL_MASK)) throw new Error(`serial must be 0-${SERIAL_MASK}`);
  const payload = (BigInt(tier) << SERIAL_BITS) | BigInt(serial);
  const value = (payload << MAC_BITS) | mac(secret, tier, serial);
  return format(encode(scramble(secret, value)));
}

/** Strip formatting and repair the characters people typically mistype. */
export function normalize(input) {
  let s = String(input || '').toUpperCase().replace(/[\s\-_]/g, '');
  if (s.startsWith('WW')) s = s.slice(2);
  return [...s].map((c) => CONFUSABLES[c] ?? c).join('');
}

/**
 * Check a key. Returns { ok, tier, serial, reason } — never throws on bad
 * input, because every value here arrives straight from a text box.
 */
export function verify(secret, input, revoked = new Set()) {
  const body = normalize(input);
  if (body.length !== KEY_CHARS) return { ok: false, reason: 'format' };

  let raw = 0n;
  for (const ch of body) {
    const d = DECODE.get(ch);
    if (d === undefined) return { ok: false, reason: 'format' };
    raw = (raw << 5n) | BigInt(d);
  }

  const value = unscramble(secret, raw);
  const given = value & MAC_MASK;
  const payload = value >> MAC_BITS;
  const serial = Number(payload & SERIAL_MASK);
  const tier = Number((payload >> SERIAL_BITS) & TIER_MASK);

  const expected = mac(secret, tier, serial);
  // Compare as fixed-width buffers so the check is constant time.
  const a = Buffer.from(given.toString(16).padStart(8, '0'), 'hex');
  const b = Buffer.from(expected.toString(16).padStart(8, '0'), 'hex');
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };

  if (!TIERS[tier]) return { ok: false, reason: 'invalid' };
  if (revoked.has(format(body)) || revoked.has(body)) return { ok: false, reason: 'revoked' };

  return { ok: true, tier, serial, licence: TIERS[tier] };
}

/* ---------- activation tokens ---------- */

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

/**
 * A short-lived token the browser keeps, so the app does not have to hold the
 * licence key itself or call home on every page load.
 */
export function issueToken(secret, { tier, serial, days = 90 }) {
  const body = { t: tier, s: serial, exp: Math.floor(Date.now() / 1000) + days * 86400 };
  const payload = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac('sha256', secret).update(payload).digest()).slice(0, 43);
  return `${payload}.${sig}`;
}

export function readToken(secret, token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return { ok: false, reason: 'format' };

  const expected = b64url(crypto.createHmac('sha256', secret).update(payload).digest()).slice(0, 43);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };

  let body;
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (!body || typeof body.exp !== 'number' || body.exp * 1000 < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  const licence = TIERS[body.t];
  if (!licence) return { ok: false, reason: 'invalid' };

  return { ok: true, tier: body.t, serial: body.s, licence, expiresAt: body.exp };
}

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify, issueToken, readToken, mint, tierByName, TIERS, SELLABLE_TIERS, TRIAL_TIER } from './lib/keys.js';
import { verifyGoogleToken } from './lib/google.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');

const PORT = Number(process.env.PORT) || 3000;
const KEY_SECRET = process.env.KEY_SECRET;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const TOKEN_DAYS = Number(process.env.TOKEN_DAYS) || 90;
const REVOKED = new Set(
  (process.env.REVOKED_KEYS || '').split(',').map((k) => k.trim().toUpperCase()).filter(Boolean)
);
// Comma-separated origins, or "*" for any. The app is served from this same
// origin by default, so the list only matters if you host the page elsewhere.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS) || 7;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const REGISTRATIONS = path.join(DATA_DIR, 'registrations.jsonl');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const GRANTS_FILE = path.join(DATA_DIR, 'grants.json');
const WRITINGS_FILE = path.join(DATA_DIR, 'writings.json');
// Optional: POST each signup somewhere else too (a mailing list, a sheet).
const REGISTRATION_WEBHOOK = process.env.REGISTRATION_WEBHOOK || '';

if (!KEY_SECRET) {
  console.error('KEY_SECRET is not set. Generate one with: openssl rand -hex 32');
  process.exit(1);
}
if (KEY_SECRET.length < 32) {
  console.error('KEY_SECRET is too short — use at least 32 characters.');
  process.exit(1);
}

/* ---------- settings and grants ----------
   Who gets what is a runtime decision, not a deploy-time one: the owner flips
   open access on or off from the admin page without touching the server. */
let settings = { openAccess: true, defaultTier: 'full' };
let grants = {};   // email -> tier id, set per person from the admin page
// A child's own sentence, waiting for a parent to look at it before it can
// ever appear to anyone else. Nothing here is shown to another family until
// its status is 'approved'.
let writings = [];

function loadStore(){
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    if (raw && typeof raw === 'object') settings = { ...settings, ...raw };
  } catch { /* first run, or unreadable — the defaults stand */ }
  try {
    const raw = JSON.parse(fs.readFileSync(GRANTS_FILE, 'utf8'));
    if (raw && typeof raw === 'object') grants = raw;
  } catch { /* none yet */ }
  try {
    const raw = JSON.parse(fs.readFileSync(WRITINGS_FILE, 'utf8'));
    if (Array.isArray(raw)) writings = raw;
  } catch { /* none yet */ }
}
function persist(file, value){
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
    return true;
  } catch (err) {
    console.error('[store] could not write', path.basename(file) + ':', err.message);
    return false;
  }
}
loadStore();

/** What this person is entitled to right now, in this order: a personal grant,
 *  then open access, then the ordinary free trial. */
function entitlementFor(email) {
  const granted = grants[String(email || '').toLowerCase()];
  if (granted) {
    try { return { tier: tierByName(granted), days: TOKEN_DAYS, reason: 'granted' }; }
    catch { /* a tier that no longer exists — fall through */ }
  }
  if (settings.openAccess) {
    try { return { tier: tierByName(settings.defaultTier), days: TOKEN_DAYS, reason: 'open' }; }
    catch { return { tier: 3, days: TOKEN_DAYS, reason: 'open' }; }
  }
  return { tier: TRIAL_TIER, days: TRIAL_DAYS, reason: 'trial' };
}

/* ---------- rate limiting ----------
   A wrong key should cost the guesser real time. In-memory is the right scope:
   one instance, and a restart clearing the counters is harmless. */
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;

function rateLimited(ip) {
  const now = Date.now();
  const hits = (attempts.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  attempts.set(ip, hits);
  return hits.length >= MAX_ATTEMPTS;
}
function recordAttempt(ip) {
  const hits = attempts.get(ip) || [];
  hits.push(Date.now());
  attempts.set(ip, hits);
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of attempts) {
    const live = hits.filter((t) => now - t < WINDOW_MS);
    if (live.length) attempts.set(ip, live);
    else attempts.delete(ip);
  }
}, WINDOW_MS).unref();

/* ---------- plumbing ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin) return {};
  const allowed = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
  if (!allowed) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-allow-methods': 'POST,GET,OPTIONS',
    'vary': 'Origin'
  };
}

function sendJson(req, res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...corsHeaders(req)
  });
  res.end(payload);
}

function readBody(req, limit = 8 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const file = path.join(PUBLIC, rel);
  // Never serve anything outside public/, whatever the path contains.
  if (!file.startsWith(PUBLIC + path.sep) && file !== path.join(PUBLIC, 'index.html')) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      // Unknown paths fall through to the app, so deep links keep working.
      fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) => {
        if (e2) return res.writeHead(404).end('Not found');
        res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' }).end(html);
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    // index.html and content.js are one unit: the page calls into the banks the
    // script defines. A browser holding yesterday's content.js beside today's
    // HTML gets "PC is not defined" and a dead page, so neither is ever cached.
    // Only truly static assets (images, fonts) get a long life.
    const mustRevalidate = ext === '.html' || ext === '.js' || ext === '.webmanifest';
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': mustRevalidate ? 'no-cache' : 'public, max-age=86400',
      'x-content-type-options': 'nosniff'
    });
    res.end(data);
  });
}

/* ---------- registrations ---------- */

// Separate from the activation limiter: signing up is a different action with
// a different sensible ceiling.
const signups = new Map();
const SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;
// A school, a childcare centre or a family on shared wifi all arrive from one
// address. Five a day turned honest classrooms away, so the ceiling is set
// where it still stops a script but never a real group of children.
const MAX_SIGNUPS = 40;

function signupLimited(ip) {
  const now = Date.now();
  const hits = (signups.get(ip) || []).filter((t) => now - t < SIGNUP_WINDOW_MS);
  signups.set(ip, hits);
  return hits.length >= MAX_SIGNUPS;
}

function looksLikeEmail(value) {
  const email = String(value || '').trim();
  if (email.length < 6 || email.length > 254) return false;
  // Deliberately loose: the only thing that really proves an address is sending
  // to it, and rejecting unusual-but-valid addresses costs a sale.
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(email);
}

function recordRegistration(entry) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(REGISTRATIONS, JSON.stringify(entry) + '\n');
  } catch (err) {
    // A full or read-only disk must not cost us the signup — the parent still
    // gets their trial, we just lose the mailing-list row.
    console.error('[register] could not save registration:', err.message);
  }
  if (REGISTRATION_WEBHOOK) {
    fetch(REGISTRATION_WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry)
    }).catch((err) => console.error('[register] webhook failed:', err.message));
  }
}

/* ---------- routes ---------- */

async function handleRegister(req, res) {
  const ip = clientIp(req);
  if (signupLimited(ip)) {
    return sendJson(req, res, 429, {
      ok: false,
      error: 'too_many_signups',
      message: 'That is a lot of trials from one place. Get in touch and we will sort you out.'
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(req, res, 400, { ok: false, error: 'bad_request' });
  }

  const name = String(body.name || '').trim().slice(0, 60);
  const email = String(body.email || '').trim().slice(0, 254);

  if (!name) {
    return sendJson(req, res, 400, { ok: false, error: 'name_required', message: 'Please tell us your name.' });
  }
  if (!looksLikeEmail(email)) {
    return sendJson(req, res, 400, { ok: false, error: 'email_invalid', message: 'That email address does not look right.' });
  }

  signups.set(ip, [...(signups.get(ip) || []), Date.now()]);

  const ent = entitlementFor(email);
  const token = issueToken(KEY_SECRET, { tier: ent.tier, serial: 0, days: ent.days, email });
  recordRegistration({
    at: new Date().toISOString(),
    name,
    email: email.toLowerCase(),
    child: String(body.child || '').trim().slice(0, 40) || null,
    ip,
    ua: String(req.headers['user-agent'] || '').slice(0, 200)
  });

  const licence = TIERS[ent.tier];
  console.log(`[register] ${email.toLowerCase()} access=${ent.reason} tier=${licence.id} ip=${ip}`);
  return sendJson(req, res, 200, {
    ok: true,
    token,
    trialDays: ent.days,
    licence: { id: licence.id, name: licence.name, maxPages: licence.maxPages, commercial: licence.commercial, trial: !!licence.trial }
  });
}

/* ---------- saved progress ----------
 *
 * Stars, levels and badges used to live in localStorage and nowhere else, so
 * a cleared browser or a second iPad meant starting again. They are now kept
 * against the account the token was issued to.
 *
 * One file per account, named by a hash of the address rather than the
 * address itself — the progress directory should not read as a mailing list
 * to anyone who gets a look at the disk.
 *
 * Merging matters more than saving. A child who plays on a phone and then a
 * tablet must not lose the afternoon's work because the tablet's copy was
 * older, so the two are merged per game, keeping the better of each, rather
 * than one overwriting the other.
 */
const PROGRESS_DIR = path.join(DATA_DIR, 'progress');
const MAX_PROGRESS_BYTES = 64 * 1024;

function progressFile(email) {
  const key = crypto.createHash('sha256').update(`papercub-progress:${email}`).digest('hex').slice(0, 32);
  return path.join(PROGRESS_DIR, `${key}.json`);
}

function readProgress(email) {
  try {
    return JSON.parse(fs.readFileSync(progressFile(email), 'utf8'));
  } catch {
    return null;
  }
}

function writeProgress(email, state) {
  try {
    fs.mkdirSync(PROGRESS_DIR, { recursive: true });
    fs.writeFileSync(progressFile(email), JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('[progress] could not save:', err.message);
    return false;
  }
}

/* Only the fields the app actually keeps, with sane bounds. Whatever a browser
   posts here comes back to a browser later, so it is rebuilt field by field
   rather than stored as sent. */
/* The quest's own ladder, kept with the rest of the account so a child who
   has climbed to level 40 finds level 40 on any device. */
function cleanQuest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const hero = String(raw.hero || '').slice(0, 16);
  if (!/^[a-z]{0,16}$/.test(hero)) return null;
  return {
    hero: hero || null,
    level: Math.min(250, Math.max(1, Math.floor(Number(raw.level) || 1))),
    best: Math.min(250, Math.max(1, Math.floor(Number(raw.best) || 1))),
    wins: Math.min(999999, Math.max(0, Math.floor(Number(raw.wins) || 0)))
  };
}

function cleanProgress(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {
    name: String(raw.name || '').slice(0, 14),
    age: Math.min(12, Math.max(3, Number(raw.age) || 5)),
    avatar: String(raw.avatar || '🦊').slice(0, 8),
    setup: !!raw.setup,
    stars: Math.min(999999, Math.max(0, Math.floor(Number(raw.stars) || 0))),
    streak: Math.min(3650, Math.max(0, Math.floor(Number(raw.streak) || 0))),
    perfects: Math.min(999999, Math.max(0, Math.floor(Number(raw.perfects) || 0))),
    lastPlayed: String(raw.lastPlayed || '').slice(0, 10),
    motion: raw.motion !== false,
    sound: raw.sound !== false,
    music: raw.music !== false,
    readAloud: raw.readAloud !== false,
    quest: cleanQuest(raw.quest),
    progress: {},
    updatedAt: Math.floor(Date.now() / 1000)
  };
  const src = raw.progress && typeof raw.progress === 'object' ? raw.progress : {};
  let n = 0;
  for (const id of Object.keys(src)) {
    if (n++ >= 200) break;
    if (!/^[a-z0-9_-]{1,24}$/i.test(id)) continue;
    const p = src[id];
    if (!p || typeof p !== 'object') continue;
    out.progress[id] = {
      level: Math.min(99, Math.max(1, Math.floor(Number(p.level) || 1))),
      stars: Math.min(99999, Math.max(0, Math.floor(Number(p.stars) || 0)))
    };
  }
  return out;
}

/* The better of the two, game by game. Nothing a child has earned is dropped
   because the other device had not heard about it yet. */
function mergeProgress(mine, theirs) {
  if (!mine) return theirs;
  if (!theirs) return mine;
  const newer = (Number(theirs.updatedAt) || 0) >= (Number(mine.updatedAt) || 0) ? theirs : mine;
  const merged = {
    ...newer,
    stars: Math.max(Number(mine.stars) || 0, Number(theirs.stars) || 0),
    perfects: Math.max(Number(mine.perfects) || 0, Number(theirs.perfects) || 0),
    streak: Math.max(Number(mine.streak) || 0, Number(theirs.streak) || 0),
    setup: !!(mine.setup || theirs.setup),
    progress: {}
  };
  const a = mine.quest, b = theirs.quest;
  if (a || b) {
    merged.quest = (!a) ? b : (!b) ? a
      : { hero: (b.hero || a.hero), level: Math.max(a.level, b.level),
          best: Math.max(a.best, b.best), wins: Math.max(a.wins, b.wins) };
  }
  const ids = new Set([...Object.keys(mine.progress || {}), ...Object.keys(theirs.progress || {})]);
  for (const id of ids) {
    const a = (mine.progress || {})[id] || { level: 1, stars: 0 };
    const b = (theirs.progress || {})[id] || { level: 1, stars: 0 };
    merged.progress[id] = {
      level: Math.max(Number(a.level) || 1, Number(b.level) || 1),
      stars: Math.max(Number(a.stars) || 0, Number(b.stars) || 0)
    };
  }
  return merged;
}

async function handleProgress(req, res) {
  let body;
  try { body = await readBody(req, MAX_PROGRESS_BYTES); }
  catch { return sendJson(req, res, 400, { ok: false, error: 'bad_request' }); }

  const result = readToken(KEY_SECRET, body.token);
  if (!result.ok) return sendJson(req, res, 401, { ok: false, error: result.reason });
  if (!result.email) {
    // A key activated without registering has no account to save against.
    return sendJson(req, res, 200, { ok: true, saved: false, reason: 'no_account' });
  }

  const stored = readProgress(result.email);

  if (req.method === 'GET' || !body.state) {
    return sendJson(req, res, 200, { ok: true, state: stored, email: result.email });
  }

  const incoming = cleanProgress(body.state);
  if (!incoming) return sendJson(req, res, 400, { ok: false, error: 'bad_state' });

  const merged = mergeProgress(stored, incoming);
  const saved = writeProgress(result.email, merged);
  // The page shows "signed in as", so it needs the address back on every
  // reply, not only on the read-only branch.
  return sendJson(req, res, 200, { ok: true, saved, state: merged, email: result.email });
}

/* ---------- Sign in with Google ----------
 *
 * The browser gets an ID token from Google Identity Services and posts it
 * here. We verify it ourselves rather than trusting it: fetch Google's public
 * keys, check the RS256 signature, then check the issuer, the audience, the
 * expiry and that Google has actually verified the address. Only then does the
 * email count as proven, and the account is created exactly as a typed
 * registration would create it.
 *
 * No library: node:crypto reads a JWK directly.
 */
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const JWKS_TTL_MS = 60 * 60 * 1000;
// Google rotates these keys, so they are refetched rather than pinned. The
// previous set is kept as a fallback for the moment a fetch fails mid-rotation.
let jwksCache = { keys: [], fetchedAt: 0 };

async function googleKeys() {
  const fresh = Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (jwksCache.keys.length && fresh) return jwksCache.keys;
  try {
    const res = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.json();
    if (Array.isArray(body.keys) && body.keys.length) {
      jwksCache = { keys: body.keys, fetchedAt: Date.now() };
    }
  } catch (err) {
    console.error('[google] could not fetch signing keys:', err.message);
    if (!jwksCache.keys.length) throw new Error('keys_unavailable');
  }
  return jwksCache.keys;
}

async function handleGoogle(req, res) {
  if (!GOOGLE_CLIENT_ID) {
    return sendJson(req, res, 503, {
      ok: false, error: 'google_not_configured',
      message: 'Google sign-in is not set up on this site yet.'
    });
  }

  const ip = clientIp(req);
  if (signupLimited(ip)) {
    return sendJson(req, res, 429, {
      ok: false, error: 'too_many_signups',
      message: 'That is a lot of sign-ins from one place. Get in touch and we will sort you out.'
    });
  }

  let body;
  try { body = await readBody(req); } catch { return sendJson(req, res, 400, { ok: false, error: 'bad_request' }); }

  let claims;
  try {
    claims = verifyGoogleToken(body.credential, { keys: await googleKeys(), clientId: GOOGLE_CLIENT_ID });
  } catch (err) {
    console.error('[google] rejected a sign-in:', err.message);
    return sendJson(req, res, 401, {
      ok: false, error: 'google_rejected',
      message: 'Google could not confirm that sign-in. Please try again.'
    });
  }

  const email = String(claims.email).trim().slice(0, 254).toLowerCase();
  const name = String(claims.name || claims.given_name || '').trim().slice(0, 60) || email.split('@')[0];

  signups.set(ip, [...(signups.get(ip) || []), Date.now()]);

  const ent = entitlementFor(email);
  const token = issueToken(KEY_SECRET, { tier: ent.tier, serial: 0, days: ent.days, email });
  recordRegistration({
    at: new Date().toISOString(),
    name,
    email,
    child: String(body.child || '').trim().slice(0, 40) || null,
    via: 'google',
    ip,
    ua: String(req.headers['user-agent'] || '').slice(0, 200)
  });

  const licence = TIERS[ent.tier];
  console.log(`[google] ${email} access=${ent.reason} tier=${licence.id} ip=${ip}`);
  return sendJson(req, res, 200, {
    ok: true,
    token,
    name,
    email,
    trialDays: ent.days,
    licence: { id: licence.id, name: licence.name, maxPages: licence.maxPages, commercial: licence.commercial, trial: !!licence.trial }
  });
}

async function handleSettings(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    return sendJson(req, res, 200, {
      ok: true,
      settings,
      grants,
      tiers: SELLABLE_TIERS.map((n) => ({ id: TIERS[n].id, name: TIERS[n].name })),
      trialDays: TRIAL_DAYS,
      registrations: countRegistrations()
    });
  }

  let body;
  try { body = await readBody(req); } catch { return sendJson(req, res, 400, { ok: false, error: 'bad_request' }); }

  if (typeof body.openAccess === 'boolean') settings.openAccess = body.openAccess;
  if (typeof body.defaultTier === 'string') {
    try { tierByName(body.defaultTier); settings.defaultTier = body.defaultTier.toLowerCase(); }
    catch (e) { return sendJson(req, res, 400, { ok: false, error: 'bad_tier', message: e.message }); }
  }
  const saved = persist(SETTINGS_FILE, settings);
  console.log(`[admin] openAccess=${settings.openAccess} defaultTier=${settings.defaultTier}`);
  return sendJson(req, res, 200, { ok: true, settings, saved });
}

async function handleGrant(req, res) {
  if (!requireAdmin(req, res)) return;

  let body;
  try { body = await readBody(req); } catch { return sendJson(req, res, 400, { ok: false, error: 'bad_request' }); }

  const email = String(body.email || '').trim().toLowerCase();
  if (!looksLikeEmail(email)) return sendJson(req, res, 400, { ok: false, error: 'email_invalid' });

  if (body.tier === null || body.tier === '' || body.tier === undefined) {
    delete grants[email];
  } else {
    try { tierByName(body.tier); } catch (e) { return sendJson(req, res, 400, { ok: false, error: 'bad_tier', message: e.message }); }
    grants[email] = String(body.tier).toLowerCase();
  }
  const saved = persist(GRANTS_FILE, grants);
  console.log(`[admin] grant ${email} -> ${grants[email] || 'revoked'}`);
  return sendJson(req, res, 200, { ok: true, grants, saved });
}

/* ---------- a child's own writing or drawing, turned into a game ----------
   Kayden or Ellyia (or anyone playing) types a sentence or draws a picture.
   It sits as 'pending' until a parent looks at it in the admin page and
   approves it - only then does it ever appear to another player, credited
   to whoever made it. A sentence becomes a one-round Sentence Builder,
   unscrambling the child's own words; a drawing becomes a small art card
   that shows the picture full size. Neither is auto-graded or auto-turned
   into a quiz - there is no model in here to write a comprehension question
   from free text or describe a drawing, so a parent decides by hand what,
   if anything, each submission becomes. */
const MAX_PENDING_PER_EMAIL = 5;
const SENTENCE_CHARS = /^[A-Za-z0-9À-ÖØ-öø-ÿ' .,!?-]+$/;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_BYTES = 260 * 1024; // a simple canvas drawing, not a photo
const MAX_WRITING_BODY_BYTES = 380 * 1024; // room for the base64 inflation

function cleanSentence(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (s.length < 6 || s.length > 90) return null;
  const words = s.split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 14) return null;
  if (!SENTENCE_CHARS.test(s)) return null;
  return s;
}

function cleanDrawing(raw) {
  const s = String(raw || '');
  const m = IMAGE_DATA_URL.exec(s);
  if (!m) return null;
  // Base64 inflates by ~4/3; this is an estimate, not a decode, since a
  // multi-hundred-KB string does not need decoding just to size-check it.
  const approxBytes = Math.floor((m[2].length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) return null;
  return s;
}

async function handleWriting(req, res) {
  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const result = readToken(KEY_SECRET, url.searchParams.get('token'));
    if (!result.ok || !result.email) return sendJson(req, res, 401, { ok: false, error: result.reason || 'no_account' });
    const mine = writings.filter((w) => w.email === result.email)
      .map((w) => ({ id: w.id, type: w.type || 'sentence', sentence: w.sentence,
        imageDataUrl: w.imageDataUrl, status: w.status, createdAt: w.createdAt }));
    return sendJson(req, res, 200, { ok: true, writings: mine });
  }

  let body;
  try { body = await readBody(req, MAX_WRITING_BODY_BYTES); }
  catch { return sendJson(req, res, 400, { ok: false, error: 'bad_request' }); }

  const result = readToken(KEY_SECRET, body.token);
  if (!result.ok) return sendJson(req, res, 401, { ok: false, error: result.reason });
  if (!result.email) return sendJson(req, res, 200, { ok: false, error: 'no_account' });

  const type = body.imageDataUrl ? 'drawing' : 'sentence';
  const entry = {
    id: crypto.randomUUID(),
    email: result.email,
    childName: String(body.childName || '').trim().slice(0, 40),
    type,
    status: 'pending',
    createdAt: Date.now(),
  };

  if (type === 'drawing') {
    const imageDataUrl = cleanDrawing(body.imageDataUrl);
    if (!imageDataUrl) {
      return sendJson(req, res, 400, { ok: false, error: 'bad_drawing',
        message: 'That drawing could not be saved. Try again.' });
    }
    entry.imageDataUrl = imageDataUrl;
  } else {
    const sentence = cleanSentence(body.sentence);
    if (!sentence) {
      return sendJson(req, res, 400, { ok: false, error: 'bad_sentence',
        message: 'That needs to be 2 to 14 words, letters and numbers only.' });
    }
    entry.sentence = sentence;
  }

  const pending = writings.filter((w) => w.email === result.email && w.status === 'pending').length;
  if (pending >= MAX_PENDING_PER_EMAIL) {
    return sendJson(req, res, 429, { ok: false, error: 'too_many_pending',
      message: 'Wait for one of your sentences or drawings to be reviewed before sending another.' });
  }

  writings.push(entry);
  const saved = persist(WRITINGS_FILE, writings);
  console.log(`[writing] ${result.email} submitted a ${type}, pending review`);
  return sendJson(req, res, 200, { ok: true, saved, writing: entry });
}

/* Public and read-only: the small set of already-approved submissions,
   which is exactly what a parent chose to let other players see. */
async function handleWritingsApproved(req, res) {
  const approved = writings.filter((w) => w.status === 'approved')
    .map((w) => ({ id: w.id, type: w.type || 'sentence', childName: w.childName || 'A player',
      sentence: w.sentence, imageDataUrl: w.imageDataUrl }));
  return sendJson(req, res, 200, { ok: true, writings: approved });
}

async function handleAdminWritings(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    return sendJson(req, res, 200, { ok: true, writings });
  }

  let body;
  try { body = await readBody(req); } catch { return sendJson(req, res, 400, { ok: false, error: 'bad_request' }); }

  const id = String(body.id || '');
  const entry = writings.find((w) => w.id === id);
  if (!entry) return sendJson(req, res, 404, { ok: false, error: 'not_found' });

  if (body.status === 'delete') {
    writings = writings.filter((w) => w.id !== id);
  } else if (['pending', 'approved', 'rejected'].includes(body.status)) {
    entry.status = body.status;
  } else {
    return sendJson(req, res, 400, { ok: false, error: 'bad_status' });
  }
  const saved = persist(WRITINGS_FILE, writings);
  console.log(`[admin] writing ${id} -> ${body.status}`);
  return sendJson(req, res, 200, { ok: true, saved, writings });
}

function readRegistrations() {
  let lines = [];
  try { lines = fs.readFileSync(REGISTRATIONS, 'utf8').split('\n').filter(Boolean); } catch { return []; }
  return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function countRegistrations() {
  const seen = new Set();
  readRegistrations().forEach((r) => seen.add(r.email));
  return { total: readRegistrations().length, unique: seen.size };
}

/* A rough read of the user-agent, enough for an admin to recognise a device.
   Deliberately not a UA-parsing library: this only has to answer "which iPad
   was that" well enough to be useful. */
function describeDevice(ua) {
  const s = String(ua || '');
  if (!s) return '';
  let os = '';
  if (/iPad/.test(s)) os = 'iPad';
  else if (/iPhone/.test(s)) os = 'iPhone';
  else if (/Android/.test(s)) os = /Mobile/.test(s) ? 'Android phone' : 'Android tablet';
  else if (/Windows NT/.test(s)) os = 'Windows';
  else if (/Mac OS X/.test(s)) os = 'Mac';
  else if (/CrOS/.test(s)) os = 'Chromebook';
  else if (/Linux/.test(s)) os = 'Linux';

  let br = '';
  if (/Edg\//.test(s)) br = 'Edge';
  else if (/OPR\//.test(s)) br = 'Opera';
  else if (/SamsungBrowser/.test(s)) br = 'Samsung';
  else if (/Firefox\//.test(s)) br = 'Firefox';
  else if (/Chrome\//.test(s)) br = 'Chrome';
  else if (/Safari\//.test(s)) br = 'Safari';

  return [os, br].filter(Boolean).join(' · ');
}

/* One row per account rather than one per sign-up, because the same family
   signing in from a phone and a tablet is one account, not two people. */
function accountRows() {
  const byEmail = new Map();

  readRegistrations().forEach((r) => {
    const email = String(r.email || '').toLowerCase();
    if (!email) return;
    let a = byEmail.get(email);
    if (!a) {
      a = { email, name: '', child: '', first: r.at, last: r.at, signIns: 0, ips: new Set(), ua: '', via: 'email' };
      byEmail.set(email, a);
    }
    a.signIns++;
    if (r.name) a.name = r.name;
    if (r.child) a.child = r.child;
    if (r.at && (!a.first || r.at < a.first)) a.first = r.at;
    if (r.at && (!a.last || r.at > a.last)) a.last = r.at;
    if (r.ip) a.ips.add(r.ip);
    if (r.ua) a.ua = r.ua;
    if (r.via) a.via = r.via;
    a.lastIp = r.ip || a.lastIp || '';
  });

  return [...byEmail.values()].map((a) => {
    const prog = readProgress(a.email);
    const games = prog && prog.progress ? Object.keys(prog.progress).length : 0;
    return {
      email: a.email,
      name: a.name,
      child: a.child,
      first: a.first,
      last: a.last,
      signIns: a.signIns,
      ip: a.lastIp || '',
      ipCount: a.ips.size,
      device: describeDevice(a.ua),
      via: a.via,
      access: grants[a.email] || (settings.openAccess ? settings.defaultTier + ' (open)' : 'trial'),
      stars: prog ? (Number(prog.stars) || 0) : 0,
      games,
      childAge: prog ? (Number(prog.age) || null) : null,
      playedAt: prog && prog.updatedAt ? new Date(prog.updatedAt * 1000).toISOString() : null
    };
  }).sort((x, y) => String(y.last || '').localeCompare(String(x.last || '')));
}

/* Removing an account means removing all of it: the sign-up lines, the saved
   progress and any personal grant. Anything left behind would quietly come
   back the next time that address signed in. */
function deleteAccount(email) {
  const target = String(email || '').toLowerCase();
  if (!target) return { ok: false, error: 'no_email' };

  let removedRows = 0;
  try {
    const kept = readRegistrations().filter((r) => {
      const match = String(r.email || '').toLowerCase() === target;
      if (match) removedRows++;
      return !match;
    });
    const body = kept.map((r) => JSON.stringify(r)).join('\n');
    fs.writeFileSync(REGISTRATIONS, body ? body + '\n' : '');
  } catch (err) {
    console.error('[admin] could not rewrite registrations:', err.message);
    return { ok: false, error: 'write_failed' };
  }

  let removedProgress = false;
  try {
    fs.unlinkSync(progressFile(target));
    removedProgress = true;
  } catch { /* nothing saved for this account */ }

  let removedGrant = false;
  if (grants[target]) { delete grants[target]; removedGrant = true; persist(GRANTS_FILE, grants); }

  console.log(`[admin] deleted ${target} (${removedRows} sign-ups, progress=${removedProgress}, grant=${removedGrant})`);
  return { ok: true, removedRows, removedProgress, removedGrant };
}

async function handleAccount(req, res) {
  if (!requireAdmin(req, res)) return;

  let body;
  try { body = await readBody(req); }
  catch { return sendJson(req, res, 400, { ok: false, error: 'bad_request' }); }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return sendJson(req, res, 400, { ok: false, error: 'no_email' });

  if (body.action === 'delete') {
    const out = deleteAccount(email);
    return sendJson(req, res, out.ok ? 200 : 500, out);
  }
  if (body.action === 'reset') {
    // Wipe what the child has earned but keep the account and its sign-ups.
    let done = false;
    try { fs.unlinkSync(progressFile(email)); done = true; } catch {}
    console.log(`[admin] reset progress for ${email} (had progress: ${done})`);
    return sendJson(req, res, 200, { ok: true, reset: done });
  }
  return sendJson(req, res, 400, { ok: false, error: 'unknown_action' });
}

async function handleRegistrations(req, res) {
  if (!requireAdmin(req, res)) return;
  const rows = readRegistrations();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const accounts = accountRows();

  if (url.searchParams.get('format') === 'json') {
    return sendJson(req, res, 200, {
      ok: true, rows: accounts.slice(0, 500), total: rows.length, accounts: accounts.length
    });
  }

  const cols = ['email', 'name', 'child', 'child_age', 'first_seen', 'last_seen', 'sign_ins',
    'last_ip', 'distinct_ips', 'device', 'signed_up_via', 'access', 'stars', 'games_played', 'last_played'];
  const csv = cols.join(',') + '\n' + accounts.map((a) =>
    [a.email, a.name, a.child, a.childAge || '', a.first, a.last, a.signIns,
     a.ip, a.ipCount, a.device, a.via, a.access, a.stars, a.games, a.playedAt || '']
      .map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  res.writeHead(200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': 'attachment; filename="registrations.csv"',
    'cache-control': 'no-store'
  });
  res.end(csv + '\n');
}

async function handleActivate(req, res) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return sendJson(req, res, 429, { ok: false, error: 'too_many_attempts', message: 'Too many tries. Wait 10 minutes and try again.' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(req, res, 400, { ok: false, error: 'bad_request' });
  }

  const result = verify(KEY_SECRET, body.key, REVOKED);
  if (!result.ok) {
    recordAttempt(ip);
    const message =
      result.reason === 'revoked'
        ? 'This key has been cancelled. Reply to your order if you think that is wrong.'
        : "That key doesn't look right. Check your receipt and try again.";
    return sendJson(req, res, 400, { ok: false, error: result.reason, message });
  }

  const token = issueToken(KEY_SECRET, { tier: result.tier, serial: result.serial, days: TOKEN_DAYS });
  console.log(`[activate] tier=${result.licence.id} serial=${result.serial} ip=${ip}`);
  return sendJson(req, res, 200, {
    ok: true,
    token,
    licence: { id: result.licence.id, name: result.licence.name, maxPages: result.licence.maxPages, commercial: result.licence.commercial, trial: !!result.licence.trial }
  });
}

async function handleVerify(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(req, res, 400, { ok: false, error: 'bad_request' });
  }
  const result = readToken(KEY_SECRET, body.token);
  if (!result.ok) return sendJson(req, res, 401, { ok: false, error: result.reason });

  // Someone holding a trial from before open access was switched on gets
  // upgraded here rather than having to sign up again.
  if (result.licence.trial && settings.openAccess) {
    let tier;
    try { tier = tierByName(settings.defaultTier); } catch { tier = 3; }
    const up = TIERS[tier];
    const token = issueToken(KEY_SECRET, { tier, serial: result.serial || 0, days: TOKEN_DAYS, email: result.email });
    return sendJson(req, res, 200, {
      ok: true,
      token,
      upgraded: true,
      licence: { id: up.id, name: up.name, maxPages: up.maxPages, commercial: up.commercial, trial: false }
    });
  }

  return sendJson(req, res, 200, {
    ok: true,
    licence: { id: result.licence.id, name: result.licence.name, maxPages: result.licence.maxPages, commercial: result.licence.commercial, trial: !!result.licence.trial },
    expiresAt: result.expiresAt
  });
}

/* Who may open /admin. Signing in with one of these Google accounts is the
   normal way in; the long ADMIN_TOKEN still works as a way back in if Google
   is ever misconfigured, which would otherwise lock the owner out of his own
   site. */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'zzoom18@gmail.com')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const ADMIN_SESSION_HOURS = 12;

function sameString(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  // timingSafeEqual throws on a length mismatch, and the length itself is not
  // worth hiding here, so it is checked first.
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function adminSign(payload) {
  return crypto.createHmac('sha256', KEY_SECRET)
    .update(`admin1:${payload}`).digest('base64url').slice(0, 43);
}

function adminSession(email) {
  const body = Buffer.from(JSON.stringify({
    e: email, x: Math.floor(Date.now() / 1000) + ADMIN_SESSION_HOURS * 3600
  })).toString('base64url');
  return `${body}.${adminSign(body)}`;
}

function readAdminSession(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  if (!sameString(parts[1], adminSign(parts[0]))) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
  catch { return null; }
  if (!claims || Number(claims.x) <= Math.floor(Date.now() / 1000)) return null;
  // Re-checked on every request, so removing an address from ADMIN_EMAILS ends
  // that person's session immediately rather than in twelve hours.
  if (ADMIN_EMAILS.indexOf(String(claims.e || '').toLowerCase()) < 0) return null;
  return claims;
}

function requireAdmin(req, res) {
  const auth = req.headers.authorization || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (given && readAdminSession(given)) return true;
  if (ADMIN_TOKEN && given && sameString(given, ADMIN_TOKEN)) return true;

  sendJson(req, res, 401, { ok: false, error: 'unauthorized' });
  return false;
}

/* Sign in to the admin page with Google. The ID token is verified exactly as a
   parent's is; the only extra step is checking the address is on the list. */
async function handleAdminLogin(req, res) {
  if (!GOOGLE_CLIENT_ID) {
    return sendJson(req, res, 503, {
      ok: false, error: 'google_not_configured',
      message: 'Google sign-in is not set up yet. Use the admin token for now.'
    });
  }

  let body;
  try { body = await readBody(req); } catch { return sendJson(req, res, 400, { ok: false, error: 'bad_request' }); }

  let claims;
  try {
    claims = verifyGoogleToken(body.credential, { keys: await googleKeys(), clientId: GOOGLE_CLIENT_ID });
  } catch (err) {
    console.error('[admin] rejected a Google sign-in:', err.message);
    return sendJson(req, res, 401, { ok: false, error: 'google_rejected', message: 'Google could not confirm that sign-in.' });
  }

  const email = String(claims.email).toLowerCase();
  if (ADMIN_EMAILS.indexOf(email) < 0) {
    console.error(`[admin] ${email} is not on the admin list`);
    return sendJson(req, res, 403, {
      ok: false, error: 'not_an_admin',
      message: 'That account is not an administrator of this site.'
    });
  }

  console.log(`[admin] signed in as ${email}`);
  return sendJson(req, res, 200, { ok: true, token: adminSession(email), email });
}

async function handleMint(req, res) {
  if (!requireAdmin(req, res)) return;

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(req, res, 400, { ok: false, error: 'bad_request' });
  }

  const count = Math.min(Math.max(Number(body.count) || 1, 1), 500);
  const from = Math.max(Number(body.from) || 0, 0);
  /* Only the one real tier is ever minted. A legacy tier name still verifies
     on an old key, but nothing new is issued against it. */
  let tier;
  try {
    tier = tierByName(body.tier || 'full');
    if (SELLABLE_TIERS.indexOf(tier) < 0) tier = SELLABLE_TIERS[0];
  } catch {
    tier = SELLABLE_TIERS[0];
  }

  const keys = [];
  for (let i = 0; i < count; i++) keys.push({ serial: from + i, key: mint(KEY_SECRET, tier, from + i) });
  return sendJson(req, res, 200, { ok: true, tier: TIERS[tier].id, keys });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/admin') { url.pathname = '/admin.html'; req.url = '/admin.html'; }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req)).end();
    return;
  }

  try {
    if (url.pathname === '/api/health') {
      return sendJson(req, res, 200, { ok: true, service: 'papercub', time: new Date().toISOString() });
    }
    /* Public, and deliberately so: a Google client ID is not a secret, and the
       page needs it before it can draw the sign-in button. */
    if (url.pathname === '/api/config') {
      return sendJson(req, res, 200, { ok: true, googleClientId: GOOGLE_CLIENT_ID || null });
    }
    if (url.pathname === '/api/register' && req.method === 'POST') return await handleRegister(req, res);
    if (url.pathname === '/api/google' && req.method === 'POST') return await handleGoogle(req, res);
    if (url.pathname === '/api/admin/login' && req.method === 'POST') return await handleAdminLogin(req, res);
    if (url.pathname === '/api/activate' && req.method === 'POST') return await handleActivate(req, res);
    if (url.pathname === '/api/verify' && req.method === 'POST') return await handleVerify(req, res);
    if (url.pathname === '/api/progress' && req.method === 'POST') return await handleProgress(req, res);
    if (url.pathname === '/api/admin/mint' && req.method === 'POST') return await handleMint(req, res);
    if (url.pathname === '/api/admin/registrations' && req.method === 'GET') return await handleRegistrations(req, res);
    if (url.pathname === '/api/admin/settings') return await handleSettings(req, res);
    if (url.pathname === '/api/admin/grant' && req.method === 'POST') return await handleGrant(req, res);
    if (url.pathname === '/api/admin/account' && req.method === 'POST') return await handleAccount(req, res);
    if (url.pathname === '/api/writing' && (req.method === 'GET' || req.method === 'POST')) return await handleWriting(req, res);
    if (url.pathname === '/api/writings/approved' && req.method === 'GET') return await handleWritingsApproved(req, res);
    if (url.pathname === '/api/admin/writings' && (req.method === 'GET' || req.method === 'POST')) return await handleAdminWritings(req, res);
    if (url.pathname.startsWith('/api/')) return sendJson(req, res, 404, { ok: false, error: 'not_found' });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(req, res, 405, { ok: false, error: 'method_not_allowed' });
    }
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error('[error]', err);
    if (!res.headersSent) sendJson(req, res, 500, { ok: false, error: 'server_error' });
  }
});

server.listen(PORT, () => {
  console.log(`Fun Game listening on :${PORT}`);
  console.log(`  admin mint endpoint: ${ADMIN_TOKEN ? 'enabled' : 'disabled (set ADMIN_TOKEN to enable)'}`);
  console.log(`  cross-origin activation: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : 'same-origin only'}`);
  console.log(`  sample access: ${TRIAL_DAYS} days, registrations saved to ${REGISTRATIONS}`);
  console.log(`  access: ${settings.openAccess ? 'OPEN — everyone gets ' + settings.defaultTier : 'trial then licence key'}`);
  console.log(`  Google sign-in: ${GOOGLE_CLIENT_ID ? 'enabled' : 'off (set GOOGLE_CLIENT_ID)'}`);
  console.log(`  admin page: /admin (sign in as ${ADMIN_EMAILS.join(', ')})`);

  /* Railway, Fly and most container hosts give a fresh, empty filesystem on
     every deploy. If DATA_DIR sits inside the app directory there, every
     registration and every child's saved stars disappear the next time the
     app is deployed — silently, which is the worst way to lose them. A volume
     has to be mounted and DATA_DIR pointed at it. */
  const EPHEMERAL_HOST = process.env.RAILWAY_ENVIRONMENT || process.env.FLY_APP_NAME ||
    process.env.RENDER || process.env.DYNO;
  if (EPHEMERAL_HOST && DATA_DIR.startsWith(ROOT)) {
    console.error('');
    console.error('  ****************************************************************');
    console.error('  *  DATA_DIR is inside the app directory on a host that wipes   *');
    console.error(`  *  it on every deploy: ${DATA_DIR}`);
    console.error('  *  Registrations and saved progress WILL be lost.              *');
    console.error('  *  Mount a volume and set DATA_DIR to it, e.g. /data           *');
    console.error('  ****************************************************************');
    console.error('');
  }
});

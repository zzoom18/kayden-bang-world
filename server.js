import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify, issueToken, readToken, mint, tierByName, TIERS, TRIAL_TIER } from './lib/keys.js';

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
let settings = { openAccess: true, defaultTier: 'studio' };
let grants = {};   // email -> tier id, set per person from the admin page

function loadStore(){
  try {
    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    if (raw && typeof raw === 'object') settings = { ...settings, ...raw };
  } catch { /* first run, or unreadable — the defaults stand */ }
  try {
    const raw = JSON.parse(fs.readFileSync(GRANTS_FILE, 'utf8'));
    if (raw && typeof raw === 'object') grants = raw;
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
  '.woff2': 'font/woff2'
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
    const mustRevalidate = ext === '.html' || ext === '.js';
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
  const token = issueToken(KEY_SECRET, { tier: ent.tier, serial: 0, days: ent.days });
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

async function handleSettings(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    return sendJson(req, res, 200, {
      ok: true,
      settings,
      grants,
      tiers: Object.values(TIERS).filter((t) => !t.trial).map((t) => ({ id: t.id, name: t.name })),
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

async function handleRegistrations(req, res) {
  if (!requireAdmin(req, res)) return;
  const rows = readRegistrations();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.searchParams.get('format') === 'json') {
    // newest first, and say what each person currently gets
    const out = rows.slice().reverse().slice(0, 500).map((r) => ({
      at: r.at, name: r.name, email: r.email, child: r.child,
      access: grants[r.email] || (settings.openAccess ? settings.defaultTier + ' (open)' : 'trial')
    }));
    return sendJson(req, res, 200, { ok: true, rows: out, total: rows.length });
  }

  const csv = 'registered_at,name,email,child\n' + rows.map((r) =>
    [r.at, r.name, r.email, r.child || ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
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
    const token = issueToken(KEY_SECRET, { tier, serial: result.serial || 0, days: TOKEN_DAYS });
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

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) {
    sendJson(req, res, 404, { ok: false, error: 'not_found' });
    return false;
  }
  const auth = req.headers.authorization || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (given.length !== ADMIN_TOKEN.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(ADMIN_TOKEN))) {
    sendJson(req, res, 401, { ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
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
  let tier;
  try {
    tier = tierByName(body.tier || 'personal');
  } catch (e) {
    return sendJson(req, res, 400, { ok: false, error: 'bad_tier', message: e.message });
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
    if (url.pathname === '/api/register' && req.method === 'POST') return await handleRegister(req, res);
    if (url.pathname === '/api/activate' && req.method === 'POST') return await handleActivate(req, res);
    if (url.pathname === '/api/verify' && req.method === 'POST') return await handleVerify(req, res);
    if (url.pathname === '/api/admin/mint' && req.method === 'POST') return await handleMint(req, res);
    if (url.pathname === '/api/admin/registrations' && req.method === 'GET') return await handleRegistrations(req, res);
    if (url.pathname === '/api/admin/settings') return await handleSettings(req, res);
    if (url.pathname === '/api/admin/grant' && req.method === 'POST') return await handleGrant(req, res);
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
  console.log(`Kayden Bang World listening on :${PORT}`);
  console.log(`  admin mint endpoint: ${ADMIN_TOKEN ? 'enabled' : 'disabled (set ADMIN_TOKEN to enable)'}`);
  console.log(`  cross-origin activation: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : 'same-origin only'}`);
  console.log(`  free trial: ${TRIAL_DAYS} days, registrations saved to ${REGISTRATIONS}`);
  console.log(`  access: ${settings.openAccess ? 'OPEN — everyone gets ' + settings.defaultTier : 'trial then licence key'}`);
  console.log(`  admin page: /admin`);
});

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify, issueToken, readToken, mint, tierByName, TIERS } from './lib/keys.js';

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

if (!KEY_SECRET) {
  console.error('KEY_SECRET is not set. Generate one with: openssl rand -hex 32');
  process.exit(1);
}
if (KEY_SECRET.length < 32) {
  console.error('KEY_SECRET is too short — use at least 32 characters.');
  process.exit(1);
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
        res.writeHead(200, { 'content-type': MIME['.html'] }).end(html);
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const isHtml = ext === '.html';
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': isHtml ? 'no-cache' : 'public, max-age=86400',
      'x-content-type-options': 'nosniff'
    });
    res.end(data);
  });
}

/* ---------- routes ---------- */

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
    licence: { id: result.licence.id, name: result.licence.name, maxPages: result.licence.maxPages, commercial: result.licence.commercial }
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
  return sendJson(req, res, 200, {
    ok: true,
    licence: { id: result.licence.id, name: result.licence.name, maxPages: result.licence.maxPages, commercial: result.licence.commercial },
    expiresAt: result.expiresAt
  });
}

async function handleMint(req, res) {
  if (!ADMIN_TOKEN) return sendJson(req, res, 404, { ok: false, error: 'not_found' });
  const auth = req.headers.authorization || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (given.length !== ADMIN_TOKEN.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(ADMIN_TOKEN))) {
    return sendJson(req, res, 401, { ok: false, error: 'unauthorized' });
  }

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

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req)).end();
    return;
  }

  try {
    if (url.pathname === '/api/health') {
      return sendJson(req, res, 200, { ok: true, service: 'worksheet-workshop', time: new Date().toISOString() });
    }
    if (url.pathname === '/api/activate' && req.method === 'POST') return await handleActivate(req, res);
    if (url.pathname === '/api/verify' && req.method === 'POST') return await handleVerify(req, res);
    if (url.pathname === '/api/admin/mint' && req.method === 'POST') return await handleMint(req, res);
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
  console.log(`Worksheet Workshop listening on :${PORT}`);
  console.log(`  admin mint endpoint: ${ADMIN_TOKEN ? 'enabled' : 'disabled (set ADMIN_TOKEN to enable)'}`);
  console.log(`  cross-origin activation: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(', ') : 'same-origin only'}`);
});

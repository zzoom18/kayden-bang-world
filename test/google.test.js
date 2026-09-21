import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyGoogleToken } from '../lib/google.js';

/* A throwaway key pair standing in for Google's. The point of these tests is
   that a forged token is rejected, so the tests have to be able to forge. */
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-key-1';
const CLIENT_ID = '1234.apps.googleusercontent.com';
const KEYS = [{ ...publicKey.export({ format: 'jwk' }), kid: KID, kty: 'RSA', alg: 'RS256', use: 'sig' }];

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const NOW = 1_700_000_000;

function claims(over = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '10987',
    email: 'parent@example.com',
    email_verified: true,
    name: 'A Parent',
    iat: NOW - 30,
    exp: NOW + 3600,
    ...over
  };
}

function sign(payload, { alg = 'RS256', kid = KID, key = privateKey } = {}) {
  const head = b64({ alg, kid, typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`, 'ascii'), key)
    .toString('base64url');
  return `${head}.${body}.${sig}`;
}

const opts = { keys: KEYS, clientId: CLIENT_ID, now: NOW };
const rejects = (token, reason, o = opts) =>
  assert.throws(() => verifyGoogleToken(token, o), new RegExp(reason));

test('accepts a well-formed token from Google', () => {
  const out = verifyGoogleToken(sign(claims()), opts);
  assert.equal(out.email, 'parent@example.com');
  assert.equal(out.name, 'A Parent');
});

test('accepts the bare issuer Google also uses', () => {
  const out = verifyGoogleToken(sign(claims({ iss: 'accounts.google.com' })), opts);
  assert.equal(out.email, 'parent@example.com');
});

test('rejects a token signed by someone else', () => {
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  rejects(sign(claims(), { key: other }), 'bad_signature');
});

test('rejects a payload edited after signing', () => {
  const token = sign(claims());
  const [h, , sig] = token.split('.');
  const swapped = b64(claims({ email: 'attacker@example.com' }));
  rejects(`${h}.${swapped}.${sig}`, 'bad_signature');
});

test('rejects alg:none', () => {
  const head = b64({ alg: 'none', kid: KID, typ: 'JWT' });
  rejects(`${head}.${b64(claims())}.`, 'bad_algorithm');
});

test('rejects a key id we do not know', () => {
  rejects(sign(claims(), { kid: 'not-a-google-key' }), 'unknown_key');
});

test('rejects a token minted for a different site', () => {
  rejects(sign(claims({ aud: 'someone-else.apps.googleusercontent.com' })), 'bad_audience');
});

test('rejects a token when no client id is configured', () => {
  rejects(sign(claims()), 'bad_audience', { keys: KEYS, clientId: '', now: NOW });
});

test('rejects a forged issuer', () => {
  rejects(sign(claims({ iss: 'https://accounts.google.com.evil.test' })), 'bad_issuer');
});

test('rejects an expired token', () => {
  rejects(sign(claims({ exp: NOW - 1 })), 'expired');
});

test('rejects a token issued in the future', () => {
  rejects(sign(claims({ iat: NOW + 3600 })), 'issued_in_future');
});

test('rejects an unverified address', () => {
  rejects(sign(claims({ email_verified: false })), 'email_unverified');
  rejects(sign(claims({ email_verified: 'false' })), 'email_unverified');
});

test('rejects a token with no address at all', () => {
  const c = claims(); delete c.email;
  rejects(sign(c), 'no_email');
});

test('rejects anything that is not a JWT', () => {
  for (const junk of ['', 'abc', 'a.b', 'a.b.c.d', null, undefined, 'not.a.jwt']) {
    assert.throws(() => verifyGoogleToken(junk, opts));
  }
});

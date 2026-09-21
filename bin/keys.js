#!/usr/bin/env node
/**
 * Mint licence keys for Etsy orders.
 *
 *   node bin/keys.js --count 50 --tier personal --from 1
 *   node bin/keys.js --count 10 --tier teacher --csv keys-teacher.csv
 *   node bin/keys.js --check WW-8QD4-K2M7-3XPA
 *
 * Serial numbers must not repeat within a tier, so keep track of the last one
 * you used — the CLI writes it to .serials.json next to the project and picks
 * up from there when you omit --from.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mint, verify, tierByName, TIERS } from '../lib/keys.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LEDGER = path.join(ROOT, '.serials.json');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

function readLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return {}; }
}
function writeLedger(ledger) {
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
}

const args = parseArgs(process.argv.slice(2));
const secret = process.env.KEY_SECRET;

if (!secret) {
  console.error('KEY_SECRET is not set.\n');
  console.error('Use the same secret as the deployed server, or keys minted here will not work there.');
  console.error('Generate one with:  openssl rand -hex 32');
  process.exit(1);
}

if (args.help || args.h) {
  console.log(`Worksheet Workshop — licence keys

  --count N        how many keys to mint (default 1)
  --tier NAME      ${Object.values(TIERS).map((t) => t.id).join(' | ')}  (default personal)
  --from N         starting serial (default: continue from .serials.json)
  --csv FILE       also write the keys to a CSV file
  --check KEY      verify a single key instead of minting
`);
  process.exit(0);
}

if (args.check) {
  const result = verify(secret, args.check);
  if (result.ok) {
    console.log(`VALID   tier=${result.licence.name}  serial=${result.serial}  maxPages=${result.licence.maxPages || 'unlimited'}`);
  } else {
    console.log(`INVALID (${result.reason})`);
    process.exit(1);
  }
  process.exit(0);
}

const tierName = typeof args.tier === 'string' ? args.tier : 'personal';
let tier;
try {
  tier = tierByName(tierName);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const count = Math.max(1, Number(args.count) || 1);
const ledger = readLedger();
const from = args.from !== undefined ? Number(args.from) : (ledger[TIERS[tier].id] ?? 1);

if (!Number.isInteger(from) || from < 0) {
  console.error('--from must be a whole number');
  process.exit(1);
}

const rows = [];
for (let i = 0; i < count; i++) {
  const serial = from + i;
  rows.push({ serial, key: mint(secret, tier, serial) });
}

ledger[TIERS[tier].id] = from + count;
writeLedger(ledger);

console.log(`\n${count} ${TIERS[tier].name} key${count === 1 ? '' : 's'} (serials ${from}–${from + count - 1}):\n`);
rows.forEach((r) => console.log('  ' + r.key));
console.log(`\nNext ${TIERS[tier].name} serial: ${from + count}  (saved to .serials.json)`);

if (typeof args.csv === 'string') {
  const csv = 'serial,key,tier\n' + rows.map((r) => `${r.serial},${r.key},${TIERS[tier].id}`).join('\n') + '\n';
  fs.writeFileSync(args.csv, csv);
  console.log(`Wrote ${args.csv}`);
}

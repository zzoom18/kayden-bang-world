# Worksheet Workshop

A personalised printable-worksheet generator for kids, sold as a licensed web app.
Buyers get a key with their order, activate it once, and can then generate unlimited
print-ready worksheets with their own child's name on them.

Thirteen activity generators — name tracing, letter tracing, number tracing, math
drills, counting, missing numbers, telling time, word search, maze, sudoku, colour by
number, dot-to-dot and pattern practice. Every sheet is generated fresh, so the same
settings never produce the same worksheet twice.

**Why generated, not a bundle of files:** the content is yours outright, there is
nothing to pirate as a ZIP, and one codebase supplies an unlimited number of Etsy
listings instead of one.

## Running it

No dependencies to install — it is plain Node, standard library only.

```bash
export KEY_SECRET=$(openssl rand -hex 32)   # keep this; see below
npm start                                   # http://localhost:3000
npm test                                    # 17 tests, no network needed
```

| Variable | Required | What it does |
| --- | --- | --- |
| `KEY_SECRET` | yes | Signs and checks every licence key. **Set once and never change it** — changing it invalidates every key you have already sold. Minimum 32 characters. |
| `ADMIN_TOKEN` | no | Enables `POST /api/admin/mint`. Leave unset to keep that endpoint off and mint keys from the CLI instead. |
| `TOKEN_DAYS` | no | How long an activated browser stays unlocked before re-checking. Default 90. |
| `REVOKED_KEYS` | no | Comma-separated keys to switch off after a refund or chargeback. |
| `ALLOWED_ORIGINS` | no | Only needed if the page is hosted on a different domain than this API. |
| `PORT` | no | Default 3000. Railway sets this for you. |

## How licensing works

Keys are **stateless**. Everything needed to check a key is inside the key itself,
signed with `KEY_SECRET`:

```
WW-7YWY-ZQ29-8MMW
   └── 60 bits: 4 tier + 24 serial + 32 signature, then Feistel-shuffled
       so consecutive serials do not produce similar-looking keys
```

There is no database. A redeploy that wipes the filesystem cannot lose a customer's
licence, and there is nothing to back up except `KEY_SECRET` itself. Forging a key
means guessing a 32-bit signature, and activation is rate limited to 12 attempts per
IP per 10 minutes.

On activation the server returns a signed token that the browser stores. The app
re-checks that token on load and otherwise works offline.

### Tiers

| Tier | Max pages per batch | Commercial use | Suggested price |
| --- | --- | --- | --- |
| `personal` | 20 | no | $12–18 |
| `family` | 40 | no | $19–24 |
| `teacher` | 100 | yes | $29–39 |
| `studio` | unlimited | yes | $59–89 |

Tiers are baked into the key, so selling an upgrade means issuing a new key — no
migration, no account system.

## Selling on Etsy

### 1. Mint a batch of keys

```bash
export KEY_SECRET=...            # the same secret the server runs with
npm run keys -- --count 50 --tier personal --csv personal-batch-1.csv
```

Serial numbers must never repeat within a tier. The CLI tracks the next serial in
`.serials.json` (git-ignored), so omit `--from` and it continues where it left off.
Keep the CSV files — they are git-ignored on purpose.

Check a single key at any time:

```bash
npm run keys -- --check WW-7YWY-ZQ29-8MMW
```

### 2. Deliver the key with the order

Etsy hands every buyer the same download, so the digital file should be a short PDF
containing the app's URL and how to activate — **not** the key itself. Send the key
per-buyer in the Etsy order message right after purchase. It takes about fifteen
seconds per order and it is what keeps keys unique.

Once volume makes that annoying, the Etsy Open API (`getShopReceipts`) can poll for
paid orders and message the key automatically. The mint endpoint exists for exactly
that: `POST /api/admin/mint` with `Authorization: Bearer $ADMIN_TOKEN`.

### 3. Refunds

Add the key to `REVOKED_KEYS` and redeploy. The next activation and the next token
check both fail.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness check (used by the Railway healthcheck). |
| `POST /api/activate` | `{ key }` → `{ token, licence }`. Rate limited. |
| `POST /api/verify` | `{ token }` → `{ licence, expiresAt }`. |
| `POST /api/admin/mint` | `{ count, tier, from }` → keys. Requires `ADMIN_TOKEN`. |

Everything else is served from `public/`.

## Deploying

### Railway

1. Push this repository to GitHub.
2. Railway → New Project → Deploy from GitHub repo.
3. Add `KEY_SECRET` (and optionally `ADMIN_TOKEN`) as service variables.
4. Settings → Networking → Custom Domain → `app.marketingagency.com.sg`, then add the
   `CNAME` Railway shows you to that domain's DNS.

`railway.json` sets the start command and points the healthcheck at `/api/health`.
There is also a `Dockerfile` if you would rather deploy as a container.

### Anywhere else

Any host that runs Node 20+ works. `node server.js` serves both the API and the page
on one port, so there is nothing else to configure.

## Layout

```
server.js              HTTP server — API routes plus static hosting
lib/keys.js            mint / verify / tokens — the whole licence model
bin/keys.js            CLI for minting batches and checking keys
test/keys.test.js      17 tests covering forgery, tampering, typos, expiry
public/index.html      the app — single file, no build step, no dependencies
```

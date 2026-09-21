# Kayden Bang World

Made by Alvin, a father in Singapore, for his two children — Kayden (Primary 3, Mee Toh
School) and Ellyia (K2). The age gap between them is why the whole app keys off age.


A learning app for children aged 3–12, sold as a licensed web app. Six games played
on screen — built for an iPad, not a printer — plus a printables section for the times
a parent does want something on paper.

**Games** (`public/index.html`): twenty-seven, grouped by subject and matched to the
child's exact Singapore school level — age 9 sees P3 games, age 10 sees P4.

- *Maths & Numbers*: Ten Frame, Number Bonds, Number Quest, Bar Models, Picture Graph,
  Area & Perimeter, Money Master (SGD), Clocks & Coins, Fraction Fun, Balance Scale
- *English & Words*: Letter Sounds, Word Builder, Rhyme Time
- *Thinking & Logic*: Shapes & Colours, Odd One Out, Sorting Boxes, Code Path
- *Science*: Quiz Lab, Five Senses, Animal Homes, Life Cycles, States of Matter,
  Plant Parts, Food Chains
- *Quick Games*: Bubble Pop, Copy the Lights, Memory Match

The MOE methods are drawn, not described: number bonds are part-part-whole circles,
bar models are proportional bars with a total brace, ten frames are real ten frames.
All of it is inline SVG — no images to load.

**Everything keys off the child's age.** On first run they enter a name, tap their age
and pick an animal. That age maps to a band — 3–4, 5–6, 7–8 or 9–12 — which decides
which games are offered, and what each one asks. A four-year-old counts pictures; an
eleven-year-old gets division and missing-number problems from the same game. Games
outside the band stay reachable under "Also try" rather than being hidden.

Levels rise as the child improves, and stars and a daily streak carry across sessions.

All the words, questions, puzzles and levels live in `public/content.js`, tagged by
band, so the banks can grow without touching the game code.

**Printables** (`public/worksheets.html`): thirteen worksheet generators — tracing,
maths, counting, clocks, word search, maze, sudoku, colour by number, dot-to-dot and
patterns — each producing an A4 page to print or save as PDF. Every sheet is generated
fresh, so the same settings never produce the same worksheet twice.

**Why generated, not a bundle of files:** the content is yours outright, there is
nothing to pirate as a ZIP, and one codebase supplies an unlimited number of Etsy
listings instead of one.

## Running it

No dependencies to install — it is plain Node, standard library only.

```bash
export KEY_SECRET=$(openssl rand -hex 32)   # keep this; see below
npm start                                   # http://localhost:3000
npm test                                    # 20 tests, no network needed
```

| Variable | Required | What it does |
| --- | --- | --- |
| `TRIAL_DAYS` | no | Length of the free trial. Default 7. |
| `DATA_DIR` | no | Where registrations are stored. Default `./data`. |
| `REGISTRATION_WEBHOOK` | no | Each signup is also POSTed here — point it at a mailing list. |
| `KEY_SECRET` | yes | Signs and checks every licence key. **Set once and never change it** — changing it invalidates every key you have already sold. Minimum 32 characters. |
| `ADMIN_TOKEN` | no | Enables `POST /api/admin/mint`. Leave unset to keep that endpoint off and mint keys from the CLI instead. |
| `TOKEN_DAYS` | no | How long an activated browser stays unlocked before re-checking. Default 90. |
| `REVOKED_KEYS` | no | Comma-separated keys to switch off after a refund or chargeback. |
| `ALLOWED_ORIGINS` | no | Only needed if the page is hosted on a different domain than this API. |
| `PORT` | no | Default 3000. Railway sets this for you. |

## How people get in

There are two doors, and no accounts to manage:

**Free trial.** A parent enters their name and email, and the server hands back a
trial token good for `TRIAL_DAYS` (7 by default). Trials get three of the six games
plus the printables, with a credit line in the worksheet footer — enough to prove the
app works, not enough to stop them buying. Signups are capped at 5 per IP
per day and appended to `data/registrations.jsonl`; that file is your mailing list, and
`GET /api/admin/registrations` returns it as CSV.

**A purchased key.** Entering a valid key replaces the trial with a full licence, lifts
the page cap and drops the footer credit. The trial and the licence use the same token
mechanism, so upgrading is instant and nothing has to be migrated.

A trial can never be minted as a key — `verify()` rejects the trial tier outright, so
even someone who worked out the key format cannot issue themselves one.

## How licensing works

Keys are **stateless**. Everything needed to check a key is inside the key itself,
signed with `KEY_SECRET`:

```
KBW-7YWY-ZQ29-8MMW
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
npm run keys -- --check KBW-7YWY-ZQ29-8MMW
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
| `POST /api/register` | `{ name, email, child? }` → `{ token, licence, trialDays }`. Starts a free trial. Rate limited to 5/IP/day. |
| `POST /api/activate` | `{ key }` → `{ token, licence }`. Rate limited to 12/IP/10min. |
| `POST /api/verify` | `{ token }` → `{ licence, expiresAt }`. |
| `POST /api/admin/mint` | `{ count, tier, from }` → keys. Requires `ADMIN_TOKEN`. |
| `GET /api/admin/registrations` | Signup list. `?format=json` for the admin page, otherwise CSV. |
| `GET/POST /api/admin/settings` | Read or change open access and the default tier. |
| `POST /api/admin/grant` | `{ email, tier }` — give one person access. `tier: ""` revokes. |

Everything else is served from `public/`.

## The admin page

`/admin` on the live site. Sign in with `ADMIN_TOKEN`; it is held in `sessionStorage`
for that tab only and never written to disk in the browser.

**Open access** is the switch that matters. With it on, everyone who registers gets the
full app immediately — no trial, no key. Trials already sitting in someone's browser are
upgraded the next time that browser checks in, so nobody has to sign up twice. Turn it
off and new sign-ups go back to a `TRIAL_DAYS` trial followed by a licence key.

**Personal grants** beat both: an email listed in the grants table always gets what it
was granted, even with open access off. That is the tool for a refund, a reviewer or a
friend, and it is undone with one button.

Settings and grants live in `settings.json` and `grants.json` under `DATA_DIR`, so they
survive restarts and redeploys. The page also mints keys and lists sign-ups.

Precedence, highest first: **personal grant → open access → trial**.

## Deploying

### Railway

1. Push this repository to GitHub.
2. Railway → New Project → Deploy from GitHub repo.
3. Add `KEY_SECRET` (and optionally `ADMIN_TOKEN`) as service variables.
4. Settings → Networking → Custom Domain → `app.marketingagency.com.sg`, then add the
   `CNAME` Railway shows you to that domain's DNS.

`railway.json` sets the start command and points the healthcheck at `/api/health`.
There is also a `Dockerfile` if you would rather deploy as a container.

### Hostinger (Business plan or above)

Node.js apps are supported through hPanel. Upload a zip of this project to the site's
`public_html`, then start a Node.js build with:

- **Application type** — `express` (it is a plain `node:http` server, but this is the
  setting that gives it a long-running process)
- **Node version** — 22
- **Root directory** — `.`   **Output directory** — `.`
- **Entry file** — `server.js`   **Build script** — `build` (a no-op; there is nothing to build)

Then add `KEY_SECRET` and `ADMIN_TOKEN` under the site's Node.js environment variables
and restart. Registrations persist on disk here, unlike on ephemeral container hosts.

### Anywhere else

Any host that runs Node 20+ works. `node server.js` serves both the API and the page
on one port, so there is nothing else to configure.

## Layout

```
server.js              HTTP server — API routes plus static hosting
lib/keys.js            mint / verify / tokens — the whole licence model
bin/keys.js            CLI for minting batches and checking keys
test/keys.test.js      20 tests covering forgery, tampering, typos, expiry, trials
public/index.html      the games — no build step, no dependencies
public/content.js      every word, question and puzzle, tagged by age band
public/worksheets.html the printables section (print or save as PDF)
data/                  registrations.jsonl — created on first signup, git-ignored
```

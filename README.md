<div align="center">

![pay-me-back banner](./public/banner.png)

# 💸 pay-me-back

**A tiny, friend-shaped microsite for collecting money from people who already trust you.**

Per-person URL · soft self-irony · a slider that visibly shrinks as people pay · three modalities (pay in full / installments / "I need more time") · anonymous leaderboard · admin dashboard · Telegram pings.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Astro 6](https://img.shields.io/badge/Astro-6.x-FF5D01?logo=astro&logoColor=white)](https://astro.build/)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages%20%2B%20Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Free tier](https://img.shields.io/badge/Hosting-%E2%82%AC0%2Fmonth-22C55E)](#what-youll-need)

</div>

Built for the awkward "hey you still owe me €50 from the cabin trip" group of about 5-15 friends — **not** for a public payments product. Self-hosted on Cloudflare's free tier; total monthly cost is €0 unless you do something exotic.

This is the open-source template version of the original `pay.leonardboeker.de`. All personal data has been stripped; you provide your own debtors, bank details, PayPal handle, and (optional) Telegram bot.

> **It's a microsite, not a payment processor.** Money still moves through PayPal or a SEPA transfer that the debtor initiates themselves. Confirmation is on the honor system — they tap "I sent it," you get a Telegram ping, your slider goes down. Trust + a shared joke is the whole UX.

---

## Contents

- [Five ways to use this](#five-ways-to-use-this)
- [Stack](#stack)
- [What you'll need](#what-youll-need)
- [Quick start (local dev)](#quick-start-local-dev)
- [Deploying (Cloudflare)](#deploying-cloudflare)
- [Replacing the pixel art](#replacing-the-pixel-art)
- [Attribution footer](#attribution-footer)
- [Customising the copy](#customising-the-copy)
- [Architecture](#architecture)
- [Pre-launch checklist](#pre-launch-checklist)
- [Data retention](#data-retention)
- [Troubleshooting](#troubleshooting)
- [License](#license) · [Contributing](#contributing)

---

## Five ways to use this

The template ships with the original "friends owe me money before my world trip" framing — but the underlying mechanic (per-token URL + soft tone + self-confirm + shrinking slider) works for any scenario where a small known group of people each owe a known amount. Five concrete riffs:

### 1. 💸 The classic pay-me-back

You fronted small things over months — cabin trip groceries, taxis, that one weird night in Lisbon — and you'd rather not awkwardly DM each person individually. Each friend gets their own URL with the specific story attached. They tap, they pay, slider goes down, you get a Telegram ping. No nagging, no spreadsheet, no group chat drama. (*This is what the original site was built for.*)

### 2. 🎁 Send-off / farewell collection

A colleague is leaving the company, a friend is moving abroad, your roommate is going back to grad school. You want to send them off with a real gift + a personal landing page that says *"here's what we're getting, here's why, drop your share."* Customise the hero copy to tell the story of why this person matters, swap the slider target to the gift's price, send the link to the group Slack. Done in 20 minutes.

### 3. 🥂 Host-fronted birthday or event

You're throwing a 30th. You booked the venue, paid the caterer, ordered the cake — and now you need to softly extract €40-per-head from twelve people without sending a single passive-aggressive message. Each guest gets their own card with the running tally of what's covered. Late RSVPs see exactly how much is left to collect.

### 4. ✈️ Post-trip cost reconciliation

Five-person Airbnb weekend in Lisbon. One person put the booking on their card; another put the rental car; somebody else floated the groceries. Instead of a Splitwise wall, generate a per-person URL that shows *just their share*, the line-items that make it up, and a one-tap PayPal link. The leaderboard lets everyone see who's already settled up without exposing amounts.

### 5. 💍 Wedding "Hochzeitskasse" / honeymoon fund

Replace the registry. A single beautiful landing page tells the how-we-met story and explains you'd rather have a contribution toward the honeymoon than a sixth toaster. Each guest URL is pre-filled with a suggested amount (e.g. €100 for close friends, €50 for plus-ones), but they can always pay extra. The slider shows the honeymoon-budget bar quietly filling up over the weeks before the wedding.

> ✨ **Got another use case?** Open an issue with a one-line description — if it stretches the template's range, it goes here.

---

## Stack

- **[Astro 6](https://astro.build/)** — static output, `getStaticPaths()` for per-token HTML
- **[Tailwind v4](https://tailwindcss.com/)** via `@tailwindcss/vite` (CSS-first config)
- **[Cloudflare Pages](https://pages.cloudflare.com/)** — static hosting + git integration
- **[Cloudflare Workers](https://workers.cloudflare.com/) + [Durable Objects](https://developers.cloudflare.com/durable-objects/) (SQLite)** — confirm endpoint, slider state, leaderboard, dynamic SEPA-QR
- **[Telegram Bot API](https://core.telegram.org/bots/api)** — optional notifications
- **[Resend](https://resend.com/)** — optional email fallback
- **[`sepa-payment-qr-code`](https://www.npmjs.com/package/sepa-payment-qr-code)** + **[`qrcode`](https://www.npmjs.com/package/qrcode)** — build EPC-QR codes at build time + on-demand in the Worker

Zero client-side framework runtime. All interactivity is hand-written `<script>` islands. Production debtor page weighs ~50 KB gzipped, hits Lighthouse Mobile ≥85 across Performance / A11y / Best Practices.

---

## What you'll need

- **Node.js 22.12+** (`.nvmrc` pins 22.16.0 to match Cloudflare Pages' build image)
- **A Cloudflare account** (free tier is fine) with a domain on Cloudflare DNS
- **A GitHub account** (free, public or private repo both work)
- **A PayPal.me handle** if you want PayPal as a payment option (skip if SEPA-only)
- **A SEPA bank account** (IBAN + BIC) — currently the template hard-validates German IBANs in `scripts/prebuild-debtors.mjs`; loosen the regex there for other EU countries
- **(Optional) A Telegram bot** for instant notifications — created via [@BotFather](https://t.me/BotFather) in ~2 minutes
- **(Optional) A Resend account** for email notifications (free tier: 3,000/mo)

---

## Quick start (local dev)

```bash
# 1. Clone + install
git clone https://github.com/<you>/<repo>.git pay-me-back
cd pay-me-back
npm install

# 2. Generate placeholder pixel art (so the build doesn't 404)
npm run gen-placeholder-character
npm run gen-placeholder-sprites

# 3. Copy the example data and edit it
cp data/debtors.example.json data/debtors.json
# Now edit data/debtors.json — replace the example tokens with real ones:
npm run gen-debtor -- --name "Alice"   --amount 50  --backstory "Cabin trip groceries"
npm run gen-debtor -- --name "Bob"     --amount 25  --backstory "Late-night taxi"

# 4. Generate an admin token (one-shot, paste into your .env)
npm run gen-debtor -- --admin

# 5. Copy + fill in env vars
cp .env.example .env
# Open .env and set: PAYLEO_ADMIN_TOKEN, PAYLEO_PAYPAL_HANDLE,
# PAYLEO_BANK_HOLDER, PAYLEO_BANK_IBAN, PAYLEO_BANK_BIC

# 6. Run the static site
npm run dev
# → http://localhost:4321/<your-debtor-token>
# → http://localhost:4321/admin/<your-admin-token>

# 7. (Optional) Run the Worker locally in another terminal
npm run worker:dev
# → http://localhost:8787
```

Open the per-token URL in the browser. You should see the three-act page with a placeholder character. Replace the placeholder PNGs in `public/sprites/` with your own art (see "Replacing the pixel art" below) when ready.

> **`#` in your project path?** Vite's virtual-module resolver chokes on `#` characters in the absolute path. If `npm run dev` fails with a Rollup error mentioning a `#`, mirror the source to a `#`-free directory (e.g. `C:\dev\pay-me-back-build`) and run from there. Cloudflare Pages builds are unaffected.

---

## Deploying (Cloudflare)

You deploy two things separately: the **static site** (Cloudflare Pages, pulls from GitHub on every push) and the **Worker + Durable Object** (deployed manually with `wrangler deploy`). They share the same custom domain via routes.

### 1. Create the Cloudflare Pages project

1. Push the repo to GitHub.
2. Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git.
3. Select your repo, then in build settings:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (project root)
4. Settings → Environment variables → Production: add every key listed in `.env.example`, especially `PAYLEO_DEBTORS_JSON` (this is the JSON string the prebuild script reads at CI time — keep `data/debtors.json` gitignored locally, paste the same content here for prod).
5. Trigger the first deploy. Visit `https://<your-project>.pages.dev/<token>` to verify.
6. Settings → Custom domains → add your domain (e.g. `pay.your-domain.com`).

### 2. Configure + deploy the Worker

The Worker is what the page calls when someone taps "I sent it" — it writes to a Durable Object, sends the notification, and serves the leaderboard.

Edit `wrangler.toml` and replace the route placeholders:

```toml
[[routes]]
pattern = "pay.your-domain.com/api/*"
zone_name = "your-domain.com"
```

Then set the secrets the Worker needs:

```bash
npx wrangler secret put PAYLEO_DEBTORS_JSON       # same JSON as the Pages env var
npx wrangler secret put PAYLEO_PAYPAL_HANDLE
npx wrangler secret put PAYLEO_BANK_HOLDER
npx wrangler secret put PAYLEO_BANK_IBAN
npx wrangler secret put PAYLEO_BANK_BIC
npx wrangler secret put PAYLEO_ADMIN_TOKEN

# Optional — only if you want notifications:
npx wrangler secret put PAYLEO_TELEGRAM_BOT_TOKEN
npx wrangler secret put PAYLEO_TELEGRAM_CHAT_ID
npx wrangler secret put PAYLEO_RESEND_API_KEY
npx wrangler secret put PAYLEO_NOTIFY_EMAIL
```

Deploy:

```bash
npm run worker:deploy
```

Verify the route works:

```bash
curl https://pay.your-domain.com/api/slider
# {"total_cents": 12345}
```

### 3. (Optional) Set up Telegram notifications

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → name it whatever (e.g. `my-pay-me-back-bot`).
2. BotFather sends back a bot token — copy it.
3. Get your chat id: message the bot once, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` and look for `"chat":{"id":...}`.
4. `npx wrangler secret put PAYLEO_TELEGRAM_BOT_TOKEN` → paste the bot token.
5. `npx wrangler secret put PAYLEO_TELEGRAM_CHAT_ID` → paste the chat id.

When a debtor self-confirms you'll get a one-line ping like:

```
💸 Alice (50 €) — Pay in full. Slider: 200 € → 150 €.
```

### 4. (Optional) Set up Resend (email fallback)

1. Sign up at [resend.com](https://resend.com/) (free: 3,000/mo).
2. Verify your sender domain in the dashboard (DNS TXT records).
3. `npx wrangler secret put PAYLEO_RESEND_API_KEY`.
4. `npx wrangler secret put PAYLEO_NOTIFY_EMAIL` → the address you want pings sent to.
5. Optional: `npx wrangler secret put PAYLEO_RESEND_FROM` to override the default sandbox `from` address. Format: `"Your Name <hello@your-domain.com>"`.

If both Telegram + Resend are configured, the Worker uses Telegram as primary and falls back to Resend on failure.

### 5. Run the smoke test

```bash
SMOKE_BASE=https://pay.your-domain.com \
SMOKE_TOKENS="<debtor-token-1>:<name-1>,<debtor-token-2>:<name-2>" \
SMOKE_ADMIN_TOKEN=<admin-token> \
npm run smoke
```

Green output = ready to send links.

---

## Replacing the pixel art

The repo ships placeholder PNGs so it builds + serves out of the box, but they're ugly on purpose. Three assets are visible:

| Path | Size | Purpose |
|---|---|---|
| `public/sprites/leo-character.png` | 256×256 | Hero character, shown in Act 1 + post-deadline view + Act 3 footer |
| `public/sprites/leo-studio.png` | 1024×768 | Background scene composited behind the character in Act 1 |
| `public/sprites/avatars/placeholder.png` | 64×64 | Default leaderboard avatar |

Per-debtor avatars: if a debtor's `characterSlug` is `"alice"`, the leaderboard tries `/sprites/avatars/alice.png`. If the file is missing, it falls back to a CSS tile with the first letter. So you can ship 0 avatars (everyone shows the letter fallback), 1 placeholder (everyone shows that), or one PNG per debtor.

### Suggested prompt (nano-banana, Aseprite, Midjourney, whatever)

```
Pixel art character, 256x256, transparent background.
Warm sunset palette (rust, ochre, peach).
Friendly cartoon figure, 3/4 view, holding a small suitcase or laptop.
Crisp 1px outline, no anti-aliasing, no gradients.
Aesthetic: 16-bit RPG portrait, GBA-era.
```

For the studio background (1024x768):

```
Pixel art interior scene, 1024x768, no characters.
Sunset light through a window, warm color palette.
Workbench with laptop, plants, a few framed prints on the wall.
Crisp pixel grid, no anti-aliasing, no gradients.
Aesthetic: cozy creative studio, "Stardew Valley" indoor vibe.
```

For per-debtor avatars (64x64):

```
Pixel art portrait avatar, 64x64, opaque tile background.
One character, head + shoulders, 16-bit RPG portrait style.
Warm sunset palette to match site theme.
Crisp pixel grid, no anti-aliasing.
```

Save them at the exact paths above. The build doesn't care about the dimensions as long as the aspect ratio is roughly right — bigger PNGs just take longer to load.

---

## Attribution footer

Every page rendered by this template ships with a small footer at the very bottom:

> 💸 Built with **pay-me-back** — make your own

It links back to this GitHub repo so visitors who like the site can find the source and build their own.

It's **on by default but easy to remove** if you'd rather not have it — the whole thing is one block in `src/layouts/BaseLayout.astro` (look for the `<footer class="built-with-footer">` near the bottom). Delete the `<footer>` element and the matching `<style>` block above it.

The MIT license technically only requires the copyright notice in the source code, not in the output. Keeping the footer is appreciated but not required. If you do customise it (e.g. point it to your own fork), please leave at least a single link back to this repo somewhere on the site so the chain stays discoverable.

---

## Customising the copy

User-facing strings live in `src/components/*.astro` and `worker/lib/notify-text.ts`. They're in English; the original (`pay.leonardboeker.de`) mixed German + English by debtor. Translate freely.

The voice guide is at `docs/TONE.md` — short, opinionated, and the reason the original site actually got people to pay back without anyone feeling lectured.

---

## Architecture

```
data/debtors.json          gitignored — real PII; mirrored to CF env var
src/data/debtors.ts        typed shim that imports the JSON above
src/pages/
  index.astro              landing (debtors get a 404 — page is empty by design)
  404.astro
  [token].astro            per-debtor page; getStaticPaths reads debtors.ts
  admin/[token].astro      admin dashboard, gated by PAYLEO_ADMIN_TOKEN
src/components/
  Act1Intro.astro          hero scene + "let's go" CTA
  Act2Reveal.astro         amount + backstory + countdown
  Act3Payment.astro        PayPal CTA + IBAN + SEPA-QR + admin contact
  ModalitySelector.astro   3 modality buttons + optional "pay extra" gift block
  ConfirmModal.astro       singleton modal
  SuccessState.astro       post-confirm view
  Leaderboard.astro        anonymous ranked tiles (worker-gated)
  PostDeadlinePage.astro   shown automatically after PAYLEO_DEADLINE
  ...
worker/
  index.ts                 router + endpoints
  durable-object.ts        SQLite DO: slider + confirm rows + reset history
  lib/
    sepa-qr.ts             on-demand SEPA-QR (canvas-free SVG → base64)
    notify-pipeline.ts     Telegram → Resend fallback
    schemas.ts             Zod input validation
    admin-auth.ts          X-Admin-Token header check
scripts/
  prebuild-debtors.mjs     CI: PAYLEO_DEBTORS_JSON → data/debtors.json
  gen-debtor.mjs           local: add debtor + nanoid token
  smoke-test.mjs           end-to-end curl checks
  ...
docs/
  TONE.md                  voice + copy guide
  RETENTION-PLAN.md        wipe-everything checklist
  LIGHTHOUSE.md            performance audit guide
```

The Worker route (`pay.your-domain.com/api/*`) and the Pages route (everything else on the same hostname) coexist via Cloudflare's routing — the Worker matches first because the `/api/*` pattern is more specific. The static page calls `fetch('/api/slider')`, the Worker answers, the slider updates.

The Durable Object is the single source of truth for slider state. It's initialized lazily from `PAYLEO_DEBTORS_JSON` (sum of all open amounts) and decrements atomically on each confirm.

---

## Pre-launch checklist

Before you actually send the links:

- [ ] All real debtor data is in CF Pages env vars + Worker secrets, not in the repo
- [ ] `data/debtors.json` shows up in `git status --ignored` (= it's gitignored)
- [ ] `PAYLEO_DEADLINE` in `wrangler.toml` matches your real deadline
- [ ] `npm run smoke` is green against the production URL
- [ ] One real test confirm fires a Telegram message you actually receive
- [ ] At least one SEPA-QR scans correctly in a real EU banking app (try DKB, Sparkasse, N26, Revolut)
- [ ] The admin page (`/admin/<token>/`) loads and shows the right debtors
- [ ] A fake admin URL (`/admin/wrong-token/`) returns 404, not 200 with an empty page
- [ ] Tone-reviewed by someone who is NOT a debtor (see `docs/TONE.md`)

---

## Data retention

`docs/RETENTION-PLAN.md` is a step-by-step "delete everything" script for after the campaign ends. Run it. The whole point of self-hosting is that you own the cleanup.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `npm run dev` fails with "Cannot find module" referencing a `#` | `#` in absolute project path breaks Vite | Mirror to a `#`-free directory (see Quick start) |
| Build fails with "PAYLEO_DEBTORS_JSON env var missing" | Prebuild script needs either a local `data/debtors.json` or the env var | Set it in CF Pages dashboard or run `cp data/debtors.example.json data/debtors.json` locally |
| Build fails with "doesn't look like a German IBAN" | Prebuild hard-validates `^DE\d{20}$` | Edit the regex in `scripts/prebuild-debtors.mjs` for your country |
| Per-token page returns 404 in dev after editing `debtors.json` | Astro caches `getStaticPaths` results | Restart `npm run dev` |
| Worker route returns 404 in prod | `wrangler.toml` route pattern doesn't match the hostname | Verify `pattern` in `wrangler.toml` matches your custom domain exactly, then `npm run worker:deploy` |
| Slider value looks wrong after editing debtor list | Durable Object cached the old initial total | `curl -X POST https://pay.your-domain.com/api/admin/reseed-slider -H "X-Admin-Token: $TOKEN"` |
| Leaderboard always hidden after refresh | 403 from `/api/leaderboard` — caller hasn't confirmed yet | Expected behaviour; the leaderboard is privacy-gated server-side |
| Telegram notification never arrives | Bot token / chat id wrong | Re-run the `getUpdates` curl from the Telegram setup section |
| Resend rejects emails | Sender domain not verified | Verify DNS in Resend dashboard, or set `PAYLEO_RESEND_FROM` to `onboarding@resend.dev` for testing |

---

## License

[MIT](./LICENSE) — do whatever, just don't blame me when your friends still don't pay back.

---

## Contributing

This is a personal toolkit released as a template, not an actively-maintained product. PRs that fix bugs or genuinely generalize a Leo-specific quirk are welcome; PRs that add scope (auth, multi-tenancy, currencies beyond EUR) are probably not. Fork it.

# Data Retention & Wipe Plan

> **When to run:** Shortly after your campaign deadline (e.g., 1–2 weeks after the last expected payment).
> **Purpose:** Concrete steps to delete all debtor PII + payment state after the project's live window closes — GDPR hygiene + clean project hand-back.

This template stores PII (names, IBAN, amounts) in three places:
1. **Cloudflare Pages env vars** — `PAYLEO_DEBTORS_JSON` is read at build time and inlined into pre-rendered HTML.
2. **Cloudflare Worker secrets** — same `PAYLEO_DEBTORS_JSON` + bank/PayPal/admin/Telegram/Resend creds.
3. **Durable Object SQLite** — confirmation rows (token + amount + timestamp + modality).

Step 1+2 wipe the source; Step 3 invalidates the served HTML; Step 5 nukes the DO history. Run them in order.

## What gets deleted (and what survives by default)

| Layer | What's there | This plan deletes |
|-------|--------------|-------------------|
| Cloudflare Pages env vars | `PAYLEO_DEBTORS_JSON` (encrypted) — names, amounts, IBANs, backstories | YES (Step 2) |
| Cloudflare Worker secrets | `PAYLEO_DEBTORS_JSON`, `PAYLEO_PAYPAL_HANDLE`, `PAYLEO_BANK_*` (3), `PAYLEO_ADMIN_TOKEN`, `PAYLEO_TELEGRAM_BOT_TOKEN`, `PAYLEO_TELEGRAM_CHAT_ID`, `PAYLEO_RESEND_API_KEY` | YES (Step 1) |
| Git repo | Source code (no PII — `data/debtors.json` is gitignored) | NO (keep) |
| Durable Object (`PAYLEO_DO` / `PayLeoDurableObject`) | Confirmation records (token + amount + timestamp + modality) | OPTIONAL — survives until Worker deleted (see Step 5) |
| CF Pages deployment | Pre-built HTML still on edge until next rebuild | Triggers rebuild → 404s for all token routes (no `PAYLEO_DEBTORS_JSON` to inject) |
| Calendar reminder | Your event "pay-me-back data wipe" | Delete manually (Step 7) |

## Step-by-step

Run each block in order. If a step fails, see Troubleshooting at the bottom.

### Step 1 — Delete Worker secrets (CLI)

From the project root:

```bash
npx wrangler secret delete PAYLEO_DEBTORS_JSON       --config wrangler.toml
npx wrangler secret delete PAYLEO_PAYPAL_HANDLE      --config wrangler.toml
npx wrangler secret delete PAYLEO_BANK_HOLDER        --config wrangler.toml
npx wrangler secret delete PAYLEO_BANK_IBAN          --config wrangler.toml
npx wrangler secret delete PAYLEO_BANK_BIC           --config wrangler.toml
npx wrangler secret delete PAYLEO_ADMIN_TOKEN        --config wrangler.toml
npx wrangler secret delete PAYLEO_TELEGRAM_BOT_TOKEN --config wrangler.toml
npx wrangler secret delete PAYLEO_TELEGRAM_CHAT_ID   --config wrangler.toml
npx wrangler secret delete PAYLEO_RESEND_API_KEY     --config wrangler.toml
npx wrangler secret delete PAYLEO_NOTIFY_EMAIL       --config wrangler.toml
```

Each prompts a confirmation. Type `y` + Enter. Expected output per secret:

```
✅ Success! Deleted secret PAYLEO_DEBTORS_JSON
```

> **If wrangler not authenticated:** run `npx wrangler login` first, then retry.
> **If secret already deleted:** harmless — wrangler returns "secret not found", continue.

### Step 2 — Delete CF Pages env vars (dashboard)

1. Open https://dash.cloudflare.com → Workers & Pages → your Pages project
2. Settings → Environment Variables → Production
3. For each of the variables listed below, click the trash icon → confirm:
   - `PAYLEO_DEBTORS_JSON`
   - `PAYLEO_PAYPAL_HANDLE`
   - `PAYLEO_BANK_HOLDER`
   - `PAYLEO_BANK_IBAN`
   - `PAYLEO_BANK_BIC`
   - `PAYLEO_ADMIN_TOKEN`
4. Save changes.

### Step 3 — Trigger rebuild → 404s everywhere

Pick one:

- **a)** In the CF Pages dashboard → Deployments → "Retry deployment" on the latest one. The prebuild script (`scripts/prebuild-debtors.mjs`) will fail because `PAYLEO_DEBTORS_JSON` no longer exists → deploy fails → old artifact stays on the edge. **Not the cleanest path** — prefer (b) or (c).
- **b)** Commit + push a no-op change:
  ```bash
  git commit --allow-empty -m "chore: trigger rebuild for data wipe"
  git push
  ```
  The rebuild will fail (no debtor JSON), but a failed deploy still purges the previous one from the edge after the build expires.
- **c)** Delete the CF Pages project entirely (see Step 6 — cleanest).

After (b) or (c), every `https://<your-domain>/<token>/` URL returns 404 within ~2 minutes (CF cache TTL).

### Step 4 — Verify wipe

```bash
SMOKE_BASE=https://<your-domain> SMOKE_TOKENS="<sample-token>:<expectedName>" npm run smoke
```

Expected output: multiple failed checks (debtor pages 404, state queries 404 once Step 5 runs). That's the success state.

Manually verify in a browser:
- `https://<your-domain>/<sample-token>/` → 404 ✓
- `https://<your-domain>/api/state?token=<sample-token>` → still 200 with `{confirmed:false}` until Step 5 (DO survives)

### Step 5 — Optional: nuke the Worker + DO (GDPR maximum cleanup)

The Durable Object survives Step 1 because it stores its own state independent of Worker secrets. Confirmation rows (token + amount + timestamp + modality) sit in the DO's SQLite until the Worker is explicitly deleted.

> **Decision point:** if nobody needs the confirmation history any longer, OR you just want to be done — delete the Worker + DO together:

```bash
npx wrangler delete pay-me-back-api --config wrangler.toml
```

(Replace `pay-me-back-api` with the `name` from your `wrangler.toml` if you renamed it.)

This destroys the Worker AND the associated `PayLeoDurableObject` SQLite storage. CF docs: "Deleting a Worker removes all associated Durable Object storage." Cannot be undone. Confirms with prompt.

### Step 6 — Optional: delete the CF Pages project (cleanest end-state)

1. CF Dashboard → Workers & Pages → your Pages project → Settings → bottom of page → "Delete project"
2. Type the project name to confirm.

After Step 6, your custom domain has no associated project; either configure a redirect to your main site or leave it as a CF "no project" 404 (fine).

### Step 7 — Your manual TODO

- [ ] Delete the calendar event "pay-me-back data wipe" (you just completed it)
- [ ] Delete your Telegram bot via @BotFather (`/deletebot` → your bot username) if no longer needed
- [ ] Delete the Resend account / API key if no longer needed (https://resend.com/settings)
- [ ] Archive local `.planning/` or notes directory (optional — zero PII; just historical artifact)

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `wrangler secret delete` says "secret not found" | Already deleted | Continue, harmless |
| `npm run smoke` still shows 200 on debtor URLs after Step 3 | CF edge cache | Wait 3 minutes, retry |
| DO state still queryable via `/api/state?token=<x>` after Step 5 | Worker still warm in some region | Wait 5 minutes (cold-start eviction) |
| Cannot delete CF Pages project | Account permission | Use the email tied to the project owner |

## Reference

- Cloudflare Workers — Delete: https://developers.cloudflare.com/workers/wrangler/commands/#delete-2
- Durable Object lifecycle: https://developers.cloudflare.com/durable-objects/api/state/#deleteall
- CF Pages env var management: https://developers.cloudflare.com/pages/configuration/build-configuration/

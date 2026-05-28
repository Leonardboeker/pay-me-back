# Lighthouse Mobile Audit

> **Goal:** A Lighthouse Mobile audit on a standard debtor page returns ≥85 in Performance, Accessibility, and Best Practices.
> **Acceptance bar:** 85+, not 100. A warm pixel-art aesthetic + custom fonts + Press Start 2P cost 10–15 perf points unavoidably. Don't chase 100.

## When to run

- Before sending debtor links for the first time (pre-launch gate).
- After any change that touches `src/components/Act*.astro`, `src/styles/global.css`, or adds sprite assets.

## How to run — Option A: Chrome DevTools (manual, ~3 min)

Recommended path. Zero MCP setup.

1. Open Chrome → `https://<your-domain>/<sample-token>/` in an Incognito window (no extensions interfering).
2. F12 → Lighthouse tab.
3. Settings:
   - Mode: **Navigation**
   - Device: **Mobile**
   - Categories: **Performance**, **Accessibility**, **Best Practices**, **SEO** (skip PWA — not in scope)
   - Throttling: **Default (Simulated throttling)**
4. Click **Analyze page load**. Wait ~30 seconds.
5. Record scores.

Repeat for at least one other token. Same template + token-rotation → scores should be near-identical. If one passes ≥85 in all three categories, the others will too.

## How to run — Option B: `lighthouse-mcp` (optional)

If you use Claude Code with the `lighthouse-mcp` server installed:

```powershell
$env:NPM_CONFIG_YES="true"; claude mcp add lighthouse --scope user -- npx lighthouse-mcp
```

In a Claude session, after `/mcp` reconnect:
```
mcp__lighthouse__audit({
  url: "https://<your-domain>/<sample-token>/",
  preset: "mobile",
  categories: ["performance", "accessibility", "best-practices"]
})
```

Returns JSON with scores. Cheaper than DevTools for repeated runs during fix iteration.

## Acceptance criteria

| Category | Min | Notes |
|----------|-----|-------|
| Performance | 85 | LCP candidate is the hero sprite. Pre-compressed sprites + palette-quantized PNGs should keep FCP/LCP low. |
| Accessibility | 85 | All `<img>` need alt-text (decorative ones can use `alt=""` + `aria-hidden="true"`). The default palette was chosen for AA-passing contrast; verify in audit. |
| Best Practices | 85 | HTTPS ✓ (CF), no console errors expected, no deprecated APIs. |
| SEO | n/a | Debtor pages set `noindex` — Lighthouse will flag "blocked from indexing" which is INTENTIONAL. Ignore. |
| PWA | n/a | Not in scope. Skip. |

## What to do if a category fails

| Category | Common fix | Where |
|----------|------------|-------|
| Performance <85 | LCP still too high → re-compress sprites with fewer colors | `node scripts/compress-sprites.mjs public/sprites/<hero>.png` |
| Performance <85 | TBT too high → check IIFEs not blocking; defer or split | `src/components/Act*.astro <script>` blocks |
| Accessibility <85 | Color contrast → adjust `--color-on-background` / `--color-primary-container` in `global.css` | `src/styles/global.css` |
| Accessibility <85 | Missing alt-text → audit `<img>` tags in components | `src/components/Act*.astro` |
| Best Practices <85 | Console errors → check Network tab during page load | Browser DevTools Console |
| Best Practices <85 | HTTPS / mixed content → verify all asset URLs use https or relative paths | `grep -r "http://" src/` should be empty |

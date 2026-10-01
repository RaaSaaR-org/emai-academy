# EmAI Academy frontend

A Nuxt layer over the Bootstrap Academy frontend at `../../frontend`. The upstream repo is never modified. This directory only adds overrides: theme, branding, landing page, legal pages, i18n texts and hidden features.

```sh
sh scripts/link-deps.sh      # ../../scripts/dev-up.sh runs this on every start
cp .env.example .env         # API = tenant gateway http://127.0.0.1:8191
npm run dev                  # http://localhost:3001  (use localhost, not 127.0.0.1)
npm run generate             # static build in .output/public (env baked in at build time)
```

Never run `npm install` here. Dependencies are per-entry symlinks into upstream `node_modules`, and a second copy of vue-i18n breaks `useI18n`.

What is where:

| Path | Purpose |
|---|---|
| `nuxt.config.ts` | `extends` upstream; tenant head entries; redirect records for Bootstrap-only routes; runtime config |
| `brand/module.ts` | the one place that changes upstream *sources* at build time: locale merge, source patches, recolor, keyed head merge, override drift check |
| `brand/patches.cjs` | string/regex patches to upstream files (contact address, TOTP issuer, /orders link, moderation notice, skill-tree node progress). Each is verified on startup; a stale patch fails `nuxt build` |
| `brand/recolor.cjs` | maps hard-coded Bootstrap navy/teal colour literals in upstream sources to the EmAI palette, by colour value (also used by `tailwind.config.js` `content.transform`) |
| `brand/overrides.json` | every tenant file that shadows an upstream file, with the upstream git blob hash it was written against (`../scripts/check-upstream.sh`) |
| `tailwind.config.js`, `assets/css/*` | upstream Tailwind config + EmAI tokens, self-hosted fonts, EmAI components |
| `locales/*.json` | EmAI texts, deep-merged into upstream `locales/*.json` at build time (no vue-i18n internals) |
| `locales/legal/*.json` | imprint/privacy source texts, copied from `emai/landing-page` |
| `components/` | EmAI Navbar/Drawer/Menu/Back/Footer/Language, stubs (UpdateNotice, FeedbackLauncher, UserHearts, UserCoins), landing-page parts |
| `pages/` | landing page and legal pages (no copies of upstream pages) |
| `middleware/` | redirect Bootstrap-only deep links to `/dashboard`; pin a bare `/learn` to the EmAI entry path |

See `../README.md` for the architecture and the list of upstream changes that would make this layer smaller.

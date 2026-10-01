# Spike result: EmAI Academy frontend (Nuxt layer)

Status (2026-10-01): working. `npm run dev` in `emai-academy/frontend` serves the EmAI Academy on
**http://localhost:3001** against the tenant gateway `http://127.0.0.1:8191`, with learning rooms
enabled. `nuxt generate` builds in about 6 s. Upstream `frontend` `git status` stayed clean throughout,
and the Bootstrap dev server on :3000 was not touched. The recipe follows `frontend-layer.md`;
this document lists what was built, how it was verified, and what is still open.

## How to run

```sh
cd emai-academy/frontend
sh scripts/link-deps.sh          # per-entry symlinks into ../../frontend/node_modules (never npm install here)
cp .env.example .env             # NUXT_PUBLIC_BASE_API_URL=http://127.0.0.1:8191, BASE_WEB_URL=http://localhost:3001,
                                 # NUXT_PUBLIC_LEARNING_ROOMS_ENABLED=true, NUXT_PUBLIC_NODE_ENV=development
npm run dev                      # = nuxt dev --port 3001 --host localhost
npm run generate                 # static SPA in .output/public; env is baked in at generate time
```

Open the app at `localhost`, not `127.0.0.1`, because learning-module origins are checked against it.
`frontend/.env` is gitignored, and `.env.example` is the committed template.

## What was built

| Area | Files | Notes |
|---|---|---|
| Layer setup | `package.json` (no `"type": "module"`), `nuxt.config.ts`, `scripts/link-deps.sh`, `.gitignore`, `.env.example` | `extends` the absolute path of `../../frontend`. No alias config, because Nuxt's `LayerAliasingPlugin` already handles upstream `~/` imports. Tailwind config path pinned via `postcss.plugins.tailwindcss.config` |
| Head / PWA | inline module in `nuxt.config.ts`, `public/manifest.webmanifest` (+ shadowed `manifest.txt`), `favicon.ico`, `brand/*`, `og-image.png` | title "EmAI Academy", `theme-color` #141414, `color-scheme` dark, og/twitter tags, font preloads; arrays are *replaced* (not duplicated). Assets copied from `emai/landing-page/public` |
| Theme | `tailwind.config.js`, `assets/css/tailwind.css` → upstream CSS + `emai.css` + `emai-pages.css` | Upstream tokens remapped: primary #141414, secondary #1F1F1F, tertiary #262626, accent #FF6700, info #2DD4BF, heading #F5F5F4, body/subheading #A8A29E. `.font-heading` is Space Grotesk, `.font-body` is Geist, subheadings are Geist Mono. Also: hairline form panels, dark text on orange buttons, focus ring, `prefers-reduced-motion` |
| Fonts | `public/fonts/*.woff2` | **Self-hosted, with no Google requests.** Space Grotesk and Geist Mono (latin + latin-ext variable woff2) were taken from the landing page's own `next/font` build output (`landing-page/out/_next/static/media`). Geist Sans came from the Geist woff2 bundled in a local `next` package. All are OFL fonts |
| Branding | `components/{Navbar,NavbarDrawer,NavbarBack,NavbarMenu,Footer,Language}.vue`, `components/emai/Logo.vue`, `public/images/logo{,-text}.png` | Logo is `logo.svg` plus the "Em" (white) / "AI" (orange) wordmark and "Academy". `Language` (used by every layout and by Modal) became a slim strip with a "Prototyp" marker and a DE / EN text toggle. The upstream logo PNG paths are shadowed with the EmAI icon as a fallback |
| Footer | `components/Footer.vue` | Academy links, EmAI Robotics links (emai.dev/{de,en}, Knowledge, info@EmAI.dev), legal links, address, "Made in Europe", prototype note. **No social links: the landing-page repo contains no LinkedIn/GitHub/etc. URLs.** |
| Landing `/` | `pages/index.vue`, `components/emai/{CurriculumSchematic,ArmSketch}.vue`, `composables/emaiCurriculum.ts` | German first, English via i18n. The hero headline is "Physical AI lernen – herstellerunabhängig, praxisnah". The hero image is the curriculum drawn as a wiring schematic (9 skill nodes, orange Builder / teal Decider routes, AND junction for 4, OR junction for 7), with toggles that highlight each track; the wires draw in once on load, and are drawn statically under reduced motion. Below it: the three principles (Selbst getestet / Herstellerunabhängig / Offen geteilt), the two track cards with their routes and outcomes, the 9-skill curriculum list (prerequisites + track tags), the hands-on section behind the brand hazard tape (G1 EDU + Dex3 spec sheet from landing-page `robots.ts`, SO-101 + LeRobot line drawing and specs), and a CTA (register / skill tree). Keeps `redirect-authenticated` middleware. Copy uses "kognitive Roboter" throughout |
| Auth visuals | `components/svg/{Login,Signup}.vue` | G1 hologram (login) and curriculum schematic (signup) replace the Bootstrap illustrations |
| Legal | `pages/docs/{imprint,privacy,terms-and-conditions}.vue`, `locales/legal/{de,en}.json` | Imprint: landing-page texts verbatim (EmAI Robotics GmbH, Halbergstraße 4, 66121 Saarbrücken, HRB 112327, GF Florian Fromm). Privacy: landing-page text plus **academy sections marked "Prototyp – Entwurf"** (hosting, account data, learning progress, necessary cookies, deletion); the Vercel hosting section was dropped because it describes the website, not the academy. Terms: a minimal placeholder, clearly marked "Prototyp – keine gültigen Nutzungsbedingungen". It stays at this path because the signup checkbox and the terms gate link there |
| i18n | `plugins/emai-i18n.ts`, `locales/{de,en-US}.json` | Post plugin merges into upstream's instance via `vueApp.__VUE_I18N_SYMBOL__`. Overrides all visible Bootstrap/Morph brand strings: hero, signup/login texts, copyright, logo alt, success/error texts with hallo@ → info{'@'}EmAI.dev, delete-account texts, `CharacterDashboard.Nav` ("Mein Lernstand" / "My progress"). New `Emai.*` namespace for tenant UI |
| Hidden features | `nuxt.config.ts` `pages:extend`, `middleware/emai-features.global.ts`, `components/NavbarMenu.vue`, `layouts/{default,inner}.vue`, stubs `components/{UpdateNotice,FeedbackLauncher}.vue`, `components/user/{Hearts,Coins}.vue` | Routes `/morphcoins/**`, `/subscription`, `/webinars/**`, `/calendar`, `/orders`, `/challenges/**` (incl. leaderboard), `/profile/challenges`, `/vertrag-*`, `/dev/**`, `/docs/right-of-withdrawal` and `/docs/terms-and-conditions-2026-*` lose their page components and become **redirect records to `/dashboard`** (no "no match" router warnings); the global middleware is a safety net (incl. `/coaching`). The nav has no Challenges link. The avatar menu shows only Mein Lernstand / Skilltree / Mein Konto / Logout (no hearts, coins, premium badge, subscription or leaderboard). Sponsors and the FAQ (MorphCoins) disappear with the landing override |
| hallo@bootstrap.academy | copies of `pages/skill-tree/index.vue`, `components/account/Delete.vue`; locale keys | replaced with info@EmAI.dev. Each copied file starts with a comment naming the upstream commit (6d4389e94835) and the one change |
| Other 1-line copies | `pages/account/mfa/initialize.vue` (TOTP issuer "EmAI Academy"), `pages/account/index.vue` (removed the `/orders` link) | same header-comment convention |
| Dashboard re-skin | `assets/css/emai-pages.css` | upstream `pages/dashboard/index.vue` hard-codes navy in scoped CSS; overridden by `main.character-page …` selectors (navy → #1F1F1F/#191919, primary action teal → orange) |

## Verification

The driver was headless Chrome over CDP, using a small script in the session scratchpad. It collects console
errors and warnings, exceptions, failed requests and HTTP ≥ 400 responses, and takes full-page screenshots.

**Dev (`nuxt dev` :3001, live gateway :8191):**
- Logged out: `/`, `/auth/login`, `/auth/signup`, `/skill-tree`, `/docs/imprint`, `/docs/privacy`,
  `/docs/terms-and-conditions` and `/contact` all render without errors. The only warning is upstream's `NUXT_E1007 definePageMeta`
  on `/auth/login` and `/auth/signup`, which comes from upstream pages calling it outside `<script setup>`.
- Redirects: `/morphcoins/buy`, `/challenges/all`, `/challenges/python/abc`, `/subscription`, `/webinars`
  and `/vertrag-kuendigen` go to `/dashboard`, and from there to `/auth/login` when logged out. There are no router warnings after the
  redirect-record change.
- Logged in: a test user was created through the gateway (`POST /auth/users`), its email was verified with the
  code from smtp4dev, and it logged in **through the real login form**. `/dashboard`, `/skill-tree` and `/account`
  render with no errors, and the avatar menu opens (screenshot). Before verification, skills-ms answered `GET /skills/xp/me` with 403,
  which is expected for unverified users.
- `/skill-tree` currently shows "No Data", because `GET /skills/skilltree` returns `{"skills":[]}` until the
  content/skills-ms agents load the EmAI curriculum.

**Production (`nuxt generate`, served statically on a temporary :3012):** `/`, `/skill-tree`, `/auth/login`,
`/auth/signup`, `/docs/imprint`, `/docs/privacy`, `/docs/terms-and-conditions` and `/morphcoins/buy` (redirect) all load with **zero**
console errors. `index.html` contains `BASE_API_URL:"http://127.0.0.1:8191"`, the EmAI title and `theme-color` #141414.
English, set via the locale cookie, renders "Learn Physical AI – vendor-neutral, hands-on", the English login copy and "Legal Notice".

Mobile (390 px): the hero, tracks, curriculum list, hardware cards and footer stack correctly with no horizontal scroll.

Screenshots are in `docs/spike/screens/frontend-*.png`: home DE 1440 + 390, home EN (prod), login, dashboard,
account with the open menu, skill tree, imprint/privacy/terms (prod).

Both servers were stopped afterwards; :3000 was still listening.

Test account left in the tenant DB (`emai_academy`): `emaifrontend` / `EmaiTest!2026x`,
`frontend-test@emai.local`, verified. Delete it or reuse it for later end-to-end checks.

## Not done / known gaps

- **Remaining Bootstrap visuals in deeper pages.** Course pages, the learning rooms (`/learn`: LoopExplorer,
  GuidedLesson, ItLabRoom, ExerciseRoom) and quizzes still carry upstream hard-coded navy/teal hex values
  (about 600 literals, mostly `components/svg/*` and the learning UIs). They are readable on the dark theme but not on-brand.
  Extend `emai-pages.css` per page, or override the SVG components, once real EmAI content runs there.
- **Course cards / course overview** were not checked with real courses, because there was no content yet. Prices ≤ 0 show
  "Kostenlos" upstream, so courses should be configured free in skills-ms.
- **Inline copy that is not i18n** stays upstream: e.g. `components/learning/ActivityHost.vue` DE/EN strings,
  "Test Login" OAuth provider label (comes from the backend), `components/account/DownloadData.vue` filename
  `bootstrap-academy-<date>.json`, gamification wording on the dashboard ("Dein Charakter", XP, levels).
- **hallo@bootstrap.academy still present** only on pruned/unreachable pages: `CommercialStatus.vue`, `CommercialAccess.vue`,
  `/moderation/*` (reachable from the account page via "Entscheidungen und Beschwerden"), the
  historical AGB pages. Moderation was kept because it is the DSA reporting flow; it uses navy `account-support.css`.
- **`/contact`** is upstream's form ("Feedback und Kontakt"). It posts to the backend, and its look is themed but not reworked.
- **Prerender output** contains SPA shells for redirect paths (`.output/public/morphcoins/…`). This is harmless, because the client router
  redirects, but a production nginx/Caddy could also 301 them.
- The hash nav links (`/#lernpfade` …) scroll correctly on `/`. Coming from another page, upstream's
  `route.global.ts` scroll-to-top after 450 ms can win over the anchor.
- `docs/spike/screens/frontend-skilltree-1440.png` shows the empty tree (no content yet).

## Findings for other owners (not frontend)

- **Backend mail templates are still Bootstrap-branded.** The verification mail subject is "Willkommen bei der Bootstrap
  Academy!" and its footer links go to `https://bootstrap.academy/{contact,docs/terms-and-conditions,docs/privacy,docs/right-of-withdrawal}`.
  The `from` (academy@emai.dev) and the verify link (`http://localhost:3001/auth/verify-account`) are already
  correct. This needs a backend config/template overlay, or an upstream change if the templates are not configurable.
- The OAuth provider list from the gateway contains `{"id":"test","name":"Test"}`, which appears as a "Test" login button.
- The terms version the frontend sends (`TERMS_VERSION = "2026-09-r4"`, upstream `composables/terms.ts`) is accepted by the
  tenant backend. EmAI-specific terms would need their own version string, which is an upstream constant.

## Upstream changes that would make the layer cleaner (not made)

1. `plugins/i18n.ts` imports locales relatively. A hook or `nuxt.options` key for extra message files would
   make the merge plugin unnecessary.
2. Hard-coded brand values that forced 1-line page copies: MFA issuer (`pages/account/mfa/initialize.vue:65`),
   `CONTACT_EMAIL` in `components/account/Delete.vue:32`, the contact email in `pages/skill-tree/index.vue:82`, and
   the `/orders` link in `pages/account/index.vue`. A `runtimeConfig.public.brand { name, contactEmail, features }`
   would remove four of the copied files.
3. A feature-flag set (`shop`, `premium`, `hearts`, `challenges`, `webinars`) checked by the nav and pages, instead
   of route pruning plus component stubs.
4. Dashboard and learning UIs: replace hard-coded hex values with the existing CSS variables, so a tenant `:root` re-skins everything.
5. `components/learning/activityRegistry.ts` is imported relatively by `ActivityHost.vue`, so tenants can only add
   interactives as `custom` ES modules, not as Vue renderers.

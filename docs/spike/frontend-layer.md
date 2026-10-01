# Spike: EmAI frontend as a Nuxt layer over the Bootstrap frontend

Status: researched and tested on 2026-10-01 against upstream `frontend` @ `develop`
(Nuxt 4.5.2, Vite 8.2.1, Vue 3.5.41, vue-i18n 11, Tailwind 3.4). I built a throwaway layer in
`docs/spike/tmp-layer-test`, ran `nuxt dev` on :3001 and `nuxt generate` six times, drove it with
headless Chromium over CDP, and then deleted it. Upstream `git status` stayed clean, and the
:3000 dev server was not touched.

All `file:line` references are relative to `<workspace>/frontend`
unless another path is given.

---

## TL;DR: the recipe that worked

```
emai-academy/frontend/
  package.json            # {"private": true, "scripts": {...}}. No "type": "module" (tailwind config is CJS)
  node_modules/           # REAL dir of per-entry symlinks -> ../../frontend/node_modules/* (see 1.4)
  nuxt.config.ts          # extends ../../frontend, inline module that replaces app.head, pages:extend pruning
  tailwind.config.js      # requires upstream config, re-points `content`, appends a font plugin
  assets/css/tailwind.css # REQUIRED: upstream css entry "~/assets/css/tailwind.css" resolves HERE
  .env                    # NUXT_PUBLIC_BASE_API_URL=http://127.0.0.1:8191 ...
  app.vue?                # only if needed (tenant wins)
  components/  pages/  layouts/  middleware/  plugins/  composables/  public/
```

Verified behaviour:

| Thing | Result |
|---|---|
| `extends: [abs path to ../../frontend]` | works; sources at the upstream repo root are picked up (no `app/` dir) |
| explicit `~/…`, `~~/…`, `@/…` imports inside upstream files | **resolve to upstream**, handled by Nuxt's built-in `LayerAliasingPlugin` (`experimental.localLayerAliases`, default true) |
| `css: ["~/assets/css/tailwind.css"]` in the upstream nuxt.config | **resolves to the tenant** (`WARN css entry ~/assets/css/tailwind.css could not be found (resolved to …/tmp-layer-test/assets/css/tailwind.css)`), so the tenant must ship that file |
| tenant `components/Footer.vue` | replaces upstream `Footer` everywhere (auto-import) |
| tenant `pages/contact.vue` | replaces upstream route `/contact` |
| tenant `composables/publicLegalRoutes.ts` exporting the same names | replaces the auto-import used by upstream `app.vue`, with no duplicate warning |
| tenant global middleware | runs; redirect `/morphcoins/buy` → `/` worked |
| tenant `pages:extend` hook | removes upstream routes (morphcoins/subscription/webinars disappeared from generate output) |
| tenant i18n merge plugin | works (`Headings.Hero` → "EmAI Academy"; new `Tenant.*` keys resolve) |
| tenant `public/manifest.txt` | overrides upstream `public/manifest.txt` in the generate output |
| upstream `frontend/.env` | **not** loaded; only the tenant cwd `.env` is read |
| `nuxt generate` | about 6 s warm, 52 routes, runtime config baked into `index.html` |

---

## 1. How the layer merge works here

### 1.1 Precedence rules (Nuxt 4.5.2 source, `node_modules/nuxt/dist/index.mjs` `resolveApp` ~L3466)

| Kind | Rule | Tenant can… |
|---|---|---|
| `app.vue`, `error.vue` | first match over `layerDirs` (tenant first) | replace |
| layouts | `layouts[name] ||= …` over `layerDirs` (tenant first) | replace by same file name (`default.vue`, `inner.vue`, `empty.vue`, `errorLayout.vue`) |
| middleware | collected base→tenant, then `uniqueBy(reverse, "name")` | **replace by same name** (e.g. `route.global.ts`) or add new ones |
| plugins | `uniqueBy(…, "src")`, deduped by **absolute path** only | **cannot replace** `plugins/i18n.ts` by file name. A tenant `plugins/i18n.ts` would run *in addition*. Either add a merge plugin (tested, see §4) or filter in the `app:resolve` hook (`app.plugins = app.plugins.filter(p => !p.src.endsWith("/frontend/plugins/i18n.ts"))`; the hook runs before the final dedupe) |
| components | scanned per layer, app layer has priority | replace by same component name (path-derived, e.g. `components/user/Coins.vue` → `UserCoins`) |
| pages | same route path → tenant file wins | replace; removal needs `pages:extend` |
| composables/utils auto-imports | tenant export of the same name wins (checked in `.nuxt/imports.d.ts`) | replace, **but only for call sites that use auto-imports** (see 1.2) |
| `public/` | tenant file shadows the same path | replace any static asset (logo PNGs, favicon, manifest, fonts) |
| `nuxt.config` | c12/defu merge, tenant first. **Arrays concatenate** (`app.head.meta`, `app.head.link`, `css`) | scalars override; arrays need an inline module (see 3.1) |

### 1.2 The `~/` / `@/` alias question

Counts in upstream (excluding `tests/`, `node_modules`, `.nuxt`):

- single `~/` references: **110 lines in 67 files**. 64 of them are `~/types/*` (49 are `import type`). There are 45 non-type runtime imports: `~/utils/*` (30), `~/composables/*` (6), `~/components/icon/*.vue` (10), plus `nuxt.config.ts:53` (`css`) and `plugins/i18n.ts:16` (`langDir: "~/locales"`, an inert option that `createI18n` ignores).
- `~~/`: **30 lines** (`~~/composables/*`, `~~/types/*`, `~~/description`).
- `@/`: **4 lines** (`components/SkillSelectionModal.vue:42-43`, `components/quiz/SubTaskListEditable.vue:47`, `components/quiz/Card.vue:41`).
- `@@/`: 0.
- Relative imports: 71, including `plugins/i18n.ts:2-3` (`../locales/*.json`).

**No workaround is needed for imports.** Nuxt 4 ships `LayerAliasingPlugin`
(`node_modules/nuxt/dist/index.mjs:6401`, enabled at :7624 via
`experimental.localLayerAliases`, default `true` in `@nuxt/schema/dist/index.mjs:695`). For every
non-root layer it rewrites `~ @ ~~ @@` in the resolveId phase to that layer's own `srcDir`/`rootDir`
whenever the importer lives in that layer. I confirmed this by rendering `/auth/login`
(`components/form/Login.vue:105-107` imports `~/components/icon/*.vue`) and `/skill-tree`
(`~/composables/skilltree`) without errors. Do **not** add alias overrides in the tenant config,
because they would break this.

The flip side is that an explicit import pins upstream code. The tenant cannot swap a module that
upstream imports explicitly. The notable pinned ones:
`~/utils/learningModule`, `~/utils/learningActivityAdapters`, `~/utils/courseJourney`,
`~/utils/itLab*`, `~/composables/fetch` (in `useLearningRooms.ts:4`, `pages/dashboard/index.vue:262`),
`~~/composables/premiumFeature` (`NavbarMenu.vue:51`), `~~/composables/user`, `~~/composables/quizzes`,
`~~/composables/codingChallenges`, `~~/composables/dialogSlot`, `~/components/icon/Morphcoin.vue`
(`course/Card.vue:35`, `calendar/Event.vue:62`), and the locale JSONs (`plugins/i18n.ts:2-3`).
To change one of these, override the **consumer** (the component or page that imports it).

Where the alias does NOT follow the layer: **nuxt.config strings**. They are resolved against the
final app (tenant), so upstream `css: ["~/assets/css/tailwind.css"]` (`nuxt.config.ts:53`) expects
`emai-academy/frontend/assets/css/tailwind.css`. Without it you get a WARN and **no CSS at all**.
The tenant file is also the cleanest theming hook (§2).

### 1.3 srcDir

Upstream has no `app/` directory, so Nuxt 4 uses the repo root as `srcDir`. The tenant should
use the same flat layout (root-level `components/`, `pages/`, …) so the two layers look the same.

### 1.4 Dependencies / node_modules (tested both ways)

The tenant has to resolve `nuxt`, `vue`, `vue-i18n`, `tailwindcss` etc. and **must share the same
physical copies** as upstream. Otherwise a tenant `useI18n()` would import a second vue-i18n and
could not find the upstream-installed instance. Options:

1. `ln -s ../../frontend/node_modules node_modules` (whole-dir symlink). This works, but Nuxt/Vite/jiti
   then write their caches **into upstream** `frontend/node_modules/.cache/{vite,jiti,nuxt}`.
   `nuxt generate` uses `buildDir = node_modules/.cache/nuxt/.nuxt` in Nuxt 4 and overwrote
   upstream's generate cache during the test. You can mitigate with `vite.cacheDir` and `buildDir`, but jiti still writes there.
2. **Recommended:** a **real** `node_modules/` directory whose entries are symlinks to each
   upstream entry (plus `.bin`). Caches land in the tenant's own `node_modules/.cache`. Packages
   resolve through realpath to the single upstream copy. Tested: `generate` wrote nothing under upstream.

```sh
# emai-academy/scripts/link-frontend-deps.sh
set -eu
T="$(cd "$(dirname "$0")/../frontend" && pwd)"
U="$(cd "$T/../../frontend/node_modules" && pwd)"
mkdir -p "$T/node_modules"
for e in "$U"/* "$U"/.bin; do ln -sfn "$e" "$T/node_modules/$(basename "$e")"; done
```

Re-run the script after upstream `npm install` adds packages. Do **not** run `npm install` in the tenant.
A tenant-only dependency (e.g. `@fontsource/*`) would need its own install and
`vite.resolve.dedupe: ["vue", "vue-i18n", "vue-router", "@vueuse/core"]`. Avoid that for the spike
and self-host fonts in `public/fonts` instead. Start commands: `./node_modules/.bin/nuxt dev --port 3001 --host localhost`
and `./node_modules/.bin/nuxt generate`. The tenant `package.json` should **not** have
`"type": "module"`, because `tailwind.config.js` must stay CJS like upstream's.

Other observations:
- The upstream nuxt.config `feedbackBuild()` runs `git rev-parse` in the **tenant** cwd
  (`nuxt.config.ts:4-18`). In a repo without commits it prints `fatal: Needed a single revision`
  and falls back to `"unavailable"`, which is harmless. After the first commit, `FEEDBACK_BUILD` holds the emai-academy SHA.
- No HMR port clash with the running :3000 server (Nuxt 4 serves HMR on the dev port).
- Harmless dev warnings that come from upstream, not the layer: `NUXT_E1007 definePageMeta … cannot be called at runtime` (`pages/index.vue:27` calls it in a non-setup `<script>`), and `Invalid prop … "icon"` from `NavbarDrawer`.
- Bind the dev server to `localhost` (not 127.0.0.1). The :3000 server listens on `[::1]`, and
  the learning-module dev check needs a localhost origin (§6).

---

## 2. Theming

Sources: `tailwind.config.js` (colors all map to CSS variables, L20-40; fonts hard-coded in plugin
utilities `.font-heading` "Ubuntu Mono" and `.font-body` "Space Mono", with `.text-subheading-1/2`
using fontFamily "Space Mono", L103-137); `assets/css/tailwind.css` (`:root` vars L9-30,
`@font-face` Ubuntu/Space Mono L33-53, `body { @apply bg-primary }` L~211, headings use
`font-heading text-heading`, `p/li` use `font-body text-body`, `hr` `text-[#20395f]`).

### 2.1 Tailwind config (tested)

Tailwind 3 runs as a PostCSS plugin (`nuxt.config.ts:55-60`, `tailwindcss: {}`). It looks up
`tailwind.config.js` **in the process cwd** (the tenant), and `content` globs are cwd-relative too.
Without a tenant config there are no utilities for upstream classes. Tenant config:

```js
// emai-academy/frontend/tailwind.config.js
const base = require("../../frontend/tailwind.config.js");
const plugin = require("tailwindcss/plugin");
const up = "../../frontend";
const globs = ["components/**/*.{js,vue,ts}", "layouts/**/*.vue", "pages/**/*.vue",
  "plugins/**/*.{js,ts}", "app.vue", "error.vue", "nuxt.config.{js,ts}"];
module.exports = {
  ...base,
  content: globs.flatMap((g) => [`./${g}`, `${up}/${g}`]),
  plugins: [
    ...base.plugins,
    // later plugin => later in output => wins at equal specificity (verified)
    plugin(({ addUtilities, addComponents }) => {
      addUtilities({
        ".font-heading": { fontFamily: '"Space Grotesk", system-ui, sans-serif' },
        ".font-body": { fontFamily: 'Geist, system-ui, sans-serif' },
      });
      addComponents({
        ".text-subheading-1": { fontFamily: '"Geist Mono", ui-monospace, monospace' },
        ".text-subheading-2": { fontFamily: '"Geist Mono", ui-monospace, monospace' },
      });
    }),
  ],
};
```

Optionally pin the path in the tenant nuxt.config so the build does not depend on cwd:
`postcss: { plugins: { tailwindcss: { config: fileURLToPath(new URL("./tailwind.config.js", import.meta.url)) } } }`.

### 2.2 CSS entry (tested)

```css
/* emai-academy/frontend/assets/css/tailwind.css  (path is mandated by upstream nuxt.config.ts:53) */
@import "../../../frontend/assets/css/tailwind.css";   /* Vite inlines it; tailwind directives included */
@import "./emai.css";                                  /* @font-face + tenant overrides */
:root {
  --color-primary: #141414;    /* page background (body bg-primary) */
  --color-secondary: #1f1f1f;  /* cards / surfaces (bg-secondary) */
  --color-tertiary: #262626;   /* navbar/footer/menus, form borders; brand has no value, pick a darker #1a1a1a or #2a2a2a */
  --color-accent: #ff6700;     /* links, highlights, buttons, scrollbar, ::selection */
  --color-star: #f5c518;
  --color-black: #0f0f0f;
  --color-dark: #141414;
  --color-light: #2a2a2a;
  --color-white: #ffffff;
  --color-heading: #f5f5f4;
  --color-subheading: #a8a29e;
  --color-body: #a8a29e;
  --color-info: #2dd4bf;       /* teal secondary */
  --color-success: #4ade80;
  --color-error: #f87171;
  --color-warning: #fbbf24;
}
```

The later `:root` wins (verified: body bg `rgb(20,20,20)`, `--color-accent: #ff6700`). Upstream
semantics: "primary" is the **background**, not the brand color, so map EmAI orange to `accent`.
Note: the landing page `src/app/globals.css` uses a slightly different base (#090C0F surface #10161B).
The brief (#141414/#1F1F1F) is used above.

Fonts: the landing page loads Space Grotesk and Geist Mono through `next/font/google`
(`landing-page/src/app/[locale]/layout.tsx:2-26`); there are no local font files to copy. For
sovereignty, self-host woff2 under `emai-academy/frontend/public/fonts/{Geist,GeistMono,SpaceGrotesk}/`
and declare `@font-face` in `emai.css`. Do not load from fonts.googleapis.com.

### 2.3 Things that stay Bootstrap-colored (hard-coded hex)

684 hex literals in `.vue` files. Most are illustrations in `components/svg/*` (Hero 115, Login 65,
EmptyStateCourse 51, HeroTwo 37, Signup 33, SkillTree 27, VerifyAccount 26, Download 20) and
learning UIs (`pages/dashboard/index.vue` 61, `components/learning/LoopExplorer.vue` 43,
`GuidedLesson.vue` 25, `ItLabRoom.vue` 21, `ExerciseRoom.vue` 20, `pages/learn.vue` 17),
`Chip.vue` 13, `FeedbackLauncher.vue` 10. Other hard-coded values: `assets/css/tailwind.css` `hr` #20395f and
`.bg-[#0d1117]` code chips; `assets/css/account-support.css` (navy surfaces #12243d/#40516a for
moderation/account docs); `tailwind.config.js` `.bg-*-light` utilities.
Plan: override `components/svg/Hero.vue`/`HeroTwo.vue`/`Login.vue`/`Signup.vue` (or the
consumers) with EmAI illustrations. For the dashboard and learning rooms, add a small
CSS override file with `!important` or attribute selectors for the worst navy/teal spots, or accept
them for the spike.

---

## 3. Branding sites

| Where | Upstream | Tenant action |
|---|---|---|
| `<head>` | `nuxt.config.ts:22-47`: title, `manifest.txt` link, theme-color #000, og/twitter → bootstrap.academy | Arrays concatenate: a tenant `app.head.meta` **adds duplicates** (tested: two `theme-color`, two manifests). Replace them in an inline module, see 3.1 (tested) |
| page title | `pages/index.vue:32-34` options-API `head.title` "Bootstrap Academy" | overridden with `pages/index.vue` |
| favicon | `public/favicon.ico` | tenant `public/favicon.ico` ← `emai/landing-page/src/app/favicon.ico`; add `public/brand/emai-icon-*.png` from `landing-page/public/brand/` |
| manifest | `public/manifest.txt` (Bootstrap JSON, icons `../images/icons/*`) | tenant `public/manifest.txt` (tested override) or a new `manifest.webmanifest` + head link, based on `landing-page/public/site.webmanifest` |
| Navbar logo | `components/Navbar.vue:5-8` `/images/logo-text.png`, alt `AltAttributes.BootstrapAcademyLogo` | option A (zero code): ship PNGs at `public/images/logo-text.png` and `public/images/logo.png`. They **must be real PNGs** (convert `landing-page/public/logo.svg` with `sips`/Chrome, because an SVG served as .png will not render). Option B: override the component |
| NavbarDrawer logo | `components/NavbarDrawer.vue:13-16` same PNG | same |
| NavbarBack logo | `components/NavbarBack.vue:6-9` `/images/logo.png`; back target `/morphcoins/buy` at :95 | same; override if morphcoins routes are pruned |
| Footer | `components/Footer.vue:5-9` logo, :18-29 Morpheus Twitter/Instagram/YouTube + GitHub, :59-100 links incl. `/vertrag-kuendigen`, `/vertrag-widerrufen`, AGB, Widerruf | **override** (tested). EmAI links: Impressum, Datenschutz, Kontakt, emai.dev, LinkedIn/GitHub if any. The copyright text is `Body.Copyright` (de.json:447) |
| Language bar | `components/Language.vue` flags `/images/de.webp`, `/images/en.webp` | keep |
| Landing `/` | `pages/index.vue:17-23` → `HeroLanding` (+`SvgHero`, `Subheadings.Hero`/`Headings.Hero`/`Body.Hero`, CTA `/auth/signup`), `HeroSponsors` (`/images/sponsors/*.webp`), `HeroAbout`, `HeroFeatures`, `HeroFAQS` (links `/morphcoins/buy`) | override `pages/index.vue` (use `<script setup>` + `definePageMeta({ middleware: ["redirect-authenticated"] })`) with EmAI hero, two tracks (Decider/Builder), embodiments, "Selbst getestet · Herstellerunabhängig · Offen geteilt". Reuse `landing-page/public/og-image.png` and illustrations |
| Imprint | `pages/docs/imprint.vue` (110 lines, bootstrap academy GmbH, München) | override with EmAI Robotics GmbH, Halbergstraße 4, 66121 Saarbrücken, info@EmAI.dev; source: `landing-page/src/app/[locale]/impressum` |
| Privacy | `pages/docs/privacy.vue` (2182 lines) | override; source `landing-page/src/app/[locale]/datenschutz`, extended for the academy (account data, learning progress, backend/skills-ms hosting) |
| AGB/Widerruf | `pages/docs/terms-and-conditions*.vue`, `right-of-withdrawal.vue`, `components/legal/TermsAndConditionsR{1,2,3}.vue`, `vertrag-kuendigen.vue`, `vertrag-widerrufen.vue` | commerce-specific. Prune via `pages:extend` for a free B2B academy, or override with a short "Nutzungsbedingungen" page. Keep `/docs/terms-and-conditions` if the TermsGate (`composables/terms.ts`) stays active |
| hallo@bootstrap.academy | `components/CommercialStatus.vue:174`, `components/CommercialAccess.vue:284`, `components/account/Delete.vue:32`, `pages/skill-tree/index.vue:82`, `pages/moderation/access.vue:241`, `pages/moderation/index.vue:485`, legal pages; locales `de.json:524,571,1206,1207` (+ en-US equivalents) | locale keys → merge plugin. `account/Delete.vue` (79 lines) → override. Commercial*/moderation → prune routes. `skill-tree/index.vue` (376 lines): override only if the certificate-upload hint matters (or change the `Body.UploadCertificates` text so the appended address reads naturally) |
| MFA issuer | `pages/account/mfa/initialize.vue:65` `issuer=Bootstrap Academy` (hard-coded) | override the page (102 lines, copy with one change → "EmAI Academy") |
| Feedback | `components/FeedbackLauncher.vue:245` "Feedback zur Bootstrap Academy", `utils/feedback.ts:111` GitHub issue regex for Bootstrap-Academy | override with a stub (empty) for the spike, or copy and rebrand |
| Update notice | `components/UpdateNotice.vue`, rendered by `app.vue:7` ("Wir entwickeln die bootstrap academy wieder aktiv weiter", `UpdateNotice.*` keys) | override with an empty component |
| Download data filename | `components/account/DownloadData.vue:45` `bootstrap-academy-${date}.json` | cosmetic, ignore |
| localStorage key | `composables/updateNotice.ts:14` `bootstrap-academy:update-notice:…` | ignore (separate origin) |
| Locale brand strings | 15 in de.json / 14 in en-US.json: `UpdateNotice.Title` L3, `Subheadings.Hero/About` L11-12, `Headings.BootstrapAcademy` L241, `Body.BuyCoins` L429, `Body.ChallengesNickname` L444, `Body.Copyright` L447, `AltAttributes.BootstrapAcademyLogo` L589, `Headings.Signup` L685, `Success.AccountCreated/Subscribed` L1053/1060, error texts L1206-1207 | merge plugin (§4) |

### 3.1 Replacing head arrays (tested)

```ts
// emai-academy/frontend/nuxt.config.ts
import { fileURLToPath } from "node:url";
const upstream = fileURLToPath(new URL("../../frontend", import.meta.url));

export default defineNuxtConfig({
  extends: [upstream],
  devServer: { port: 3001, host: "localhost" },
  modules: [
    (_options, nuxt) => {
      // defu concatenates arrays, so replace them after the merge
      nuxt.options.app.head.title = "EmAI Academy";
      nuxt.options.app.head.link = [
        { rel: "icon", href: "/favicon.ico" },
        { rel: "manifest", href: "/manifest.webmanifest" },
      ];
      nuxt.options.app.head.meta = [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#141414" },
        { name: "description", content: "Souveräne Physical AI für Unternehmen – EmAI Academy" },
        { property: "og:title", content: "EmAI Academy" },
        { property: "og:image", content: "https://academy.emai.dev/og-image.png" },
        // …
      ];
    },
  ],
  hooks: {
    "pages:extend"(pages) {
      const drop = /^\/(morphcoins|subscription|webinars|calendar|orders|challenges|matchings|quizzes\/(edit|create)|vertrag-|docs\/terms-and-conditions-2026|docs\/right-of-withdrawal)/;
      for (let i = pages.length - 1; i >= 0; i--) if (drop.test(pages[i].path)) pages.splice(i, 1);
    },
  },
  runtimeConfig: { public: { BASE_API_URL: "http://127.0.0.1:8191", BASE_WEB_URL: "http://localhost:3001", learningRoomsEnabled: true } },
});
```

(The generated head then contained exactly the tenant tags.)

---

## 4. i18n

`plugins/i18n.ts:1-24`: `createI18n({ legacy:false, globalInjection:true, messages:{ "en-US": en, de }, locale: cookie||"de" })`, 
with messages imported **relatively** (`../locales/*.json`, L2-3), so tenant locale files cannot shadow them.
The `langDir`/`loadLanguagesAsync`/`strategy` options (L15-17) are @nuxtjs/i18n leftovers that vue-i18n ignores.
The locale cookie is written in `components/Language.vue`.

A tenant `plugins/i18n.ts` does not replace upstream (plugins dedupe by absolute path).
**Tested approach:** a post plugin that merges into the installed instance. vue-i18n v11 provides
itself under a per-app symbol `app.__VUE_I18N_SYMBOL__`, **not** under the exported
`I18nInjectionKey`. The first attempt with `inject(I18nInjectionKey)` failed with "injection not found".

```ts
// emai-academy/frontend/plugins/emai-i18n.ts
import de from "../locales/de.json";      // tenant overrides only (deep-merged)
import en from "../locales/en-US.json";

export default defineNuxtPlugin({
  name: "emai-i18n",
  enforce: "post",
  setup({ vueApp }) {
    const sym = (vueApp as any).__VUE_I18N_SYMBOL__;
    const i18n: any = sym && vueApp.runWithContext(() => inject(sym));
    if (!i18n) throw new Error("upstream i18n not installed");
    i18n.global.mergeLocaleMessage("de", de);
    i18n.global.mergeLocaleMessage("en-US", en);
  },
});
```

`mergeLocaleMessage` deep-merges, so tenant files only need the overridden keys plus new
`Emai.*` namespaces. Upstream top-level namespaces: UpdateNotice, English, German, Subheadings,
VerdictHint, Headings, Body, AltAttributes, List, Forms, Inputs, Buttons, Links, Success, Error,
Months, Days, EmptyStates, PaypalRecovery, Moderation, Claims, EventCancellation, ClaimAccess,
LearningAccess, RetainedCourses, CourseContinuation, CaseOpen, PremiumContinuation, Originals,
AccessCopy, ReportCopy, CharacterDashboard, LearningRooms (about 1.9k lines each). Messages use vue-i18n syntax, so
escape `@` as `{'@'}` (e.g. `info{'@'}emai.dev`). House style: "kognitive Roboter", never "humanoide Roboter".

Alternative (not needed): drop the upstream plugin in the `app:resolve` hook and ship a full tenant copy.

Some components carry inline DE/EN copy instead of i18n keys (e.g. `components/learning/ActivityHost.vue:55-70`,
`FeedbackLauncher.vue` `text(de, en)`). Those can only change through component overrides.

---

## 5. Hiding Bootstrap-only features (no upstream change)

Three tools, in order of preference:

1. **Prune routes** with `pages:extend` (tested). Removed routes become 404/`error.vue`.
2. **Override the nav components/layouts** that link to them.
3. **Stub components** by overriding them with an empty SFC of the same name, e.g.
   `components/user/Coins.vue`: `<template><span v-if="false" /></template>`.
   Optionally add a global middleware (`middleware/emai-features.global.ts`, tested) as a safety net
   that redirects old deep links to `/dashboard`.

| Feature | Entry points (links) | Pages to prune | Components to override/stub |
|---|---|---|---|
| MorphCoins / shop | `NavbarMenu.vue:5` `<UserCoins/>`; `components/user/Coins.vue` → `/morphcoins/buy`; `hero/FAQS.vue` → `/morphcoins/buy`; `NavbarBack.vue:95`; `PaypalCheckoutStatus.vue`; `form/BuyCoins.vue`, `form/Profile.vue` | `/morphcoins/*` (buy, error, index, paypal, success), `/orders` | `UserCoins` (also used in `pages/challenges/*`), `HeroFAQS`. Course cards show "Kostenlos" when `price <= 0` (`course/Card.vue:10-18`), so configure courses with price 0 in skills-ms |
| Premium / subscription | `NavbarMenu.vue:8-16` premium badge + link L68-71 `/subscription`; `user/Hearts.vue`, `user/Profile.vue`, `course/Overview.vue` → `/subscription`; `LearningAccess.vue` → `PremiumContinuation` | `/subscription` | override `NavbarMenu.vue` (132 lines) with only "Mein Konto" + Logout |
| Hearts | `NavbarMenu.vue:4` `<UserHearts/>`; `user/RefillHeartBtn.vue`; learning exercise controller updates hearts (`CustomActivity.vue:60,152`) | none | stub `UserHearts` in the nav. Hearts semantics live in the backend/skills-ms (do not stub `useHeartInfo`, the learning player uses it) |
| Challenges | `layouts/default.vue:27-30` "Links.Challenges" `/challenges/all`; `NavbarBack.vue:105-118`; `user/Challenges.vue`; skill-tree quiz/matching buttons (`skill-tree/NodeDetailsStepper.vue`, `skill-tree/Header.vue`) | `/challenges/**`, `/profile/challenges`; optionally `/quizzes/edit-*`, `/profile/quizzes` | override `layouts/default.vue` (57 lines). Keep `/quizzes/solve-*`/`/matchings/solve-*` if skill-tree practice is wanted |
| Leaderboard | `NavbarMenu.vue:72-75` `/challenges/leader-board`; `user/Challenges.vue` | covered by `/challenges/**` | via NavbarMenu override |
| Webinars / calendar / coaching | `form/Webinar.vue` → `/calendar`; `calendar/EventBooking.vue` → `/webinars/:id`; links from `/profile/courses` | `/webinars/**`, `/calendar` | none needed after pruning |
| Sponsors | `pages/index.vue:19` `<HeroSponsors/>` | none | replaced by the index override |
| Commerce legal / moderation | Footer L76-83 `/vertrag-kuendigen`, `/vertrag-widerrufen`; `/moderation` (DSA reports) | `/vertrag-*`, `/docs/right-of-withdrawal`, `/docs/terms-and-conditions-2026-09-*`, optionally `/moderation/**` | Footer override. `composables/publicLegalRoutes.ts` lists these as public; a tenant can override `isPublicLegalRoute` (tested) |
| Update notice / feedback | `app.vue:7`, `app.vue:18` | none | stub `UpdateNotice`, optionally `FeedbackLauncher` |
| Dev pages | `/dev/*` | prune | none |

Nav links: `layouts/default.vue:16-50` has authorized = Dashboard (`CharacterDashboard.Nav`), Skill Tree, Challenges.
Guest = Home, Skill Tree, Contact. `NavbarMenu.vue:63-76` has Account, Subscription, LeaderBoard.
`Footer.vue:59-72` has Home, Skill Tree, Contact. The navbar components receive `links` as props from
the layout, so overriding **only `layouts/default.vue`** fixes the top nav and drawer. Override `NavbarMenu.vue` for the
avatar menu (coins, hearts, premium) and `Footer.vue` separately. `layouts/inner.vue` uses `NavbarBack`.

`pages/dashboard/index.vue` (character dashboard) has no coins, hearts or challenges UI of its own. It
shows skills, courses and learning-rooms progress, and uses `learningRoomsEnabled` (L276, L349-351). Keep it.

---

## 6. Learning rooms UI and the custom module contract

### 6.1 Switches
- `runtimeConfig.public.learningRoomsEnabled` (`nuxt.config.ts:67`, default `true`), read as
  `String(x) === "true"` in `composables/useLearningRooms.ts:23` and `pages/dashboard/index.vue:349`.
  The dashboard also calls `GET /skills/rooms/capabilities` (L350) and the room store calls it in
  `utils/learningRooms.ts:364`. Server-side, skills-ms `rooms_enabled` (settings.py:33) must be true too.
- API paths (all through `BASE_API_URL`, i.e. the gateway): `/skills/rooms?…` (`utils/learningRooms.ts:214`),
  `/skills/rooms/{unit}{action}` (L78), `/skills/rooms/capabilities` (L364). The route is `/learn`
  (`pages/learn.vue`), reached from course pages and the dashboard (`utils/courseJourney.ts`).

### 6.2 Renderers (`components/learning/activityRegistry.ts:4-16`)
Fixed map `renderer id → lazy component`: `loop-explorer`, `guided-lesson`, `io-machine|bit-lab|file-workspace|step-machine|network-lab` (all `ItLabRoom.vue`),
`exercise`, `legacy-video`, `video`, `custom`. It is imported **relatively** by `ActivityHost.vue:29`, so a tenant
cannot extend the map without overriding `ActivityHost.vue`. **Use `custom` + ES modules for EmAI-specific interactives**
(robot kinematics sliders, dataset explorers, VLA pipeline diagrams). No frontend rebuild is needed per module.
Mapping (`utils/learningActivityAdapters.ts:23-53,105-114`): unit `room: "custom"` → kind `custom` → renderer
`custom` only if `unit.module` is present. `content` is localized by `activityContent()` (L11-14): if
`content.de`/`content.en` exist, the module receives only the matching one.

### 6.3 Module contract (`types/learningModule.ts`, `utils/learningModule.ts`, `docs/learning-modules.md`)

Descriptor (server-issued, never from the URL), `types/learningModule.ts:4-8`:
```ts
{ id: string /* ^[a-z0-9][a-z0-9-]{0,79}$ */, api_version: 1, entry_url: string }
```
The browser module must `export const apiVersion = 1` and `export function mount(element, host)`, which returns
(or resolves to) `{ update(context), dispose(), cancelPreparation?() }` (L52-64). Otherwise:
"Incompatible learning module exports" or "Invalid learning module instance" (`utils/learningModule.ts:161-177`).

`host` (L40-50, implemented at `utils/learningModule.ts:116-151`):
- `host.context` returns a snapshot: `{ activityId, reviewId?, locale, content, state, disabled, assessment? }`
- `host.signal` is an AbortSignal, aborted on dispose/error
- `host.change(state)` takes a full JSON object state (must be a non-array object). It is ignored when disabled or closed
- `await host.save()` resolves to boolean
- `host.complete(answer)` requests server evaluation (it does not confirm anything). If the unit has an `exercise`, it only takes effect after the assessment reports `phase: "correct"` (`CustomActivity.vue:92-99`)
- `host.setBusy(bool)` locks navigation
- `host.assessment?` (only when the unit has `exercise`): `submit({answers}|{answer}|{code, environment})`, `check()`, `newAttempt()`

Lifecycle: `update()` is called on locale/state/disabled changes. A new activity/review/user gives a new instance
(`utils/learningModule.ts:184-190`, `CustomActivity.vue:159-172`). `__academy_assessment` in the state belongs to the host.
The module renders into a fresh `<div>` that the host puts into `.module-surface`. It inherits the app font and color,
so the EmAI theme applies automatically if the module uses `currentColor` and `inherit`.

URL rules in the frontend (`utils/learningModule.ts:53-67`): `entry_url` must be `https:`, **or** `http:` with
**the same origin as the page** and a hostname in localhost/127.0.0.1/[::1]. It must not contain credentials or a hash.
Loaded via `import(/* @vite-ignore */ url)` (L90). On failure, the retry saves the work and then does `location.reload()`.

Packaging (`scripts/build-learning-module.mjs`): source dir with `module.json` `{ "id", "api_version": 1, "entry": "index.js" }`
plus browser-ready `.js/.mjs` and assets (no dotfiles or symlinks; `manifest.json` is a reserved name). Output is
`<output>/<sha256>/…` + `manifest.json` + a rewritten `module.json` = descriptor with
`entry_url = <base-url>/<sha256>/<entry>`. `--base-url` must be https unless `--allow-local` is passed and the host is localhost (L38-51).
Reference module: `tests/fixtures/learning-module/{module.json,index.js}` (number slider, 50 lines). Use it as the template.

Server side (skills-ms-rooms, for the end-to-end picture): the catalogue unit has `room: "custom"` +
`module_id` (`api/schemas/rooms.py:65-77`). `public_unit()` resolves it from the `lesson_modules` table
(`api/services/rooms.py:136-142`, `api/services/lesson_modules.py:29-45`). You register with
`register-lesson-module <descriptor.json>` (pyproject script → `api/register_lesson_module.py`). The origin
must be in `LESSON_MODULE_ORIGINS`; http is accepted only with `LESSON_MODULE_LOCAL_DEVELOPMENT=true` + localhost
(`lesson_modules.py:15-26`). Private packages (`entry_url` under `<public_base_url>/private-lesson-modules/<sha>/…`)
are served through `/skills/lesson-assets/{grant}/{sha}/{path}` using **nginx `X-Accel-Redirect`**
(`api/endpoints/lesson_assets.py:16-28`). The Caddy dev gateway does not follow that header.

**Dev recipe (spike):** serve module packages from the tenant frontend itself, so they share the page's origin and pass the frontend check:
```sh
node ../../frontend/scripts/build-learning-module.mjs --source ../content/lesson-modules/so101-kinematics \
  --output public/learning-modules --base-url http://localhost:3001/learning-modules/ --allow-local
# skills-ms (:8011): LESSON_MODULE_ORIGINS='["http://localhost:3001"]' LESSON_MODULE_LOCAL_DEVELOPMENT=true
# then: register-lesson-module public/learning-modules/<sha>/module.json
```
Open the app as **http://localhost:3001** (not 127.0.0.1:3001, which is a different origin from the one the descriptor names).
A module on the gateway origin (:8191) fails the frontend's same-origin http rule. For production, use https on an allowed origin.

---

## 7. Runtime config and env vars

`nuxt.config.ts:62-69`. The env mapping is `NUXT_PUBLIC_` + the key in SCREAMING_SNAKE (tested for both):

| Key | Env var | Upstream default | EmAI dev |
|---|---|---|---|
| `BASE_API_URL` | `NUXT_PUBLIC_BASE_API_URL` | `https://api.test.bootstrap.academy` | `http://127.0.0.1:8191` (EmAI Caddy gateway) |
| `BASE_WEB_URL` | `NUXT_PUBLIC_BASE_WEB_URL` | `https://test.bootstrap.academy` | `http://localhost:3001` (OAuth callback `composables/oauth.ts:27-28`, MFA redirect `pages/account/mfa/enable.vue:89-91`) |
| `NODE_ENV` | `NUXT_PUBLIC_NODE_ENV` | `production` | `development` enables fetch debug logging (`composables/fetch.js:81-82,125-126`) |
| `FEEDBACK_BUILD` | `NUXT_PUBLIC_FEEDBACK_BUILD` | git SHA of cwd | optional |
| `learningRoomsEnabled` | `NUXT_PUBLIC_LEARNING_ROOMS_ENABLED` | `true` | `true` |

- With `ssr:false` + `nuxt generate`, values are **baked at generate time** into `index.html`
  (`window.__NUXT__.config`, verified). Changing them later requires a rebuild.
- In dev, only the tenant's own `.env` (cwd) is loaded. The upstream `frontend/.env` (which points to :8190) is ignored (verified).
- Consumers: `composables/fetch.js:27-31`, `composables/auth.ts:29-35`, `composables/useLearningRooms.ts:13-58`,
  `composables/calendar.ts:14-15`, `composables/contracts.ts:76`, `composables/moderation.ts:103`,
  `components/{LearningAccess,OriginalDocuments,RetainedCourses,CommercialAccess,FeedbackLauncher}.vue`,
  `pages/dashboard/index.vue:276`, `pages/moderation/access.vue:50,121`.

---

## 8. Build order for the real tenant frontend

1. `scripts/link-frontend-deps.sh` (§1.4); `frontend/package.json`; `.gitignore` (`node_modules`, `.nuxt`, `.output`, `.env`).
2. `nuxt.config.ts` (§3.1), `tailwind.config.js` (§2.1), `assets/css/tailwind.css` + `emai.css` + fonts (§2.2).
3. `plugins/emai-i18n.ts` + `locales/{de,en-US}.json` overrides (§4).
4. Overrides: `layouts/default.vue`, `components/{Footer,NavbarMenu,UpdateNotice}.vue`, `pages/index.vue`
   (+ `components/emai/*` hero sections), `pages/docs/{imprint,privacy}.vue`, `pages/account/mfa/initialize.vue`,
   `components/account/Delete.vue`, optional `components/FeedbackLauncher.vue` stub, `components/svg/{Hero,Login,Signup}.vue`.
5. `public/`: favicon.ico, `images/logo.png`, `images/logo-text.png` (real PNGs), `brand/*`, `og-image.png`, manifest, fonts, `learning-modules/`.
6. Optional `middleware/emai-features.global.ts` safety redirects.
7. `scripts/dev-frontend.sh`: `cd frontend && ./node_modules/.bin/nuxt dev --port 3001 --host localhost`.

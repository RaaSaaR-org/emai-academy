// EmAI Academy: source patches applied to upstream files at build time (brand/module.ts).
//
// This replaces whole-file copies of upstream SFCs that only changed 1-3 lines. Upstream
// fixes to these files now flow through automatically. Every patch is checked against the
// upstream file on startup: if its `find` text is gone (upstream changed that spot), the dev
// server prints a loud error and `nuxt build` fails, so a patch can never silently stop applying.
"use strict";

const brand = require("./brand.cjs");

/** Replacements applied to every upstream source file (outside `excludeFiles`). */
const global = [
  { find: "hallo@bootstrap.academy", replace: brand.contactEmail, why: "Bootstrap support address" },
  { find: "Bootstrap Academy", replace: brand.name, why: "product name" },
];

/** Upstream files the global replacements must not touch (legal texts of the Bootstrap operator;
 *  the tenant ships its own legal pages, so these are not rendered anyway). */
const excludeFiles = [/^components\/legal\//, /^pages\/docs\//];

/**
 * Targeted patches: file is relative to the upstream frontend root. `find` must occur
 * exactly `count` times (default 1) in the upstream file.
 */
const patches = [
  {
    file: "pages/account/index.vue",
    why: "No purchases in EmAI Academy: drop the link to /orders (the route is pruned).",
    find: /\s*<NuxtLink to="\/orders"[^>]*>\{\{\s*t\("Body\.PurchaseOrders"\)\s*\}\}<\/NuxtLink>/,
    replace: "",
  },
  {
    file: "pages/moderation/index.vue",
    why: "EmAI runs no challenges-ms, so 'task notices unavailable' is always shown and misleading.",
    find: 'v-if="!loading && !m.available.value"',
    replace: 'v-if="false"',
  },
  {
    file: "components/skill-tree/Node.vue",
    why: "Upstream nodes only change look at level > 25, so early progress was invisible. Show level and XP under the name.",
    find: '{{ node?.name ?? "" }}\n      </h6>',
    replace:
      '{{ node?.name ?? "" }}\n      </h6>\n      <p v-if="node && node.name != \'start\' && (viewSubtree ? root_skill_xp_value : sub_skill_xp_value) > 0" class="emai-node-progress">{{ $t("CharacterDashboard.Level", { level: (viewSubtree ? root_skill_level_value : sub_skill_level_value) ?? 0 }) }} · {{ viewSubtree ? root_skill_xp_value : sub_skill_xp_value }} XP</p>',
  },
  // Must-match guards for spots the global replacements are relied on for. If upstream moves
  // the contact address into config (see README, upstream PR list), these fail and can go.
  { file: "components/account/Delete.vue", why: "contact address", find: "hallo@bootstrap.academy", replace: brand.contactEmail },
  { file: "pages/skill-tree/index.vue", why: "contact address", find: "hallo@bootstrap.academy", replace: brand.contactEmail },
  { file: "pages/moderation/access.vue", why: "contact address", find: "hallo@bootstrap.academy", replace: brand.contactEmail, count: 2 },
  { file: "pages/account/mfa/initialize.vue", why: "TOTP issuer", find: 'encodeURIComponent("Bootstrap Academy")', replace: `encodeURIComponent(${JSON.stringify(brand.totpIssuer)})` },
];

module.exports = { global, excludeFiles, patches };

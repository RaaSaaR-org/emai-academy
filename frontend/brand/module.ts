// EmAI Academy brand module. Everything the tenant changes in upstream *sources* goes through here,
// so the set of override points stays small, explicit and checked:
//
//  1. Locale merge: upstream plugins/i18n.ts imports ../locales/{de,en-US}.json. The tenant
//     deep-merges its own locales/*.json into those modules at build time. No vue-i18n internals.
//  2. Source patches (brand/patches.cjs): string/regex patches to upstream files, each one
//     verified on startup (dev: loud error, build: failure).
//  3. Recolor (brand/recolor.cjs): hard-coded Bootstrap navy/teal literals in upstream sources are
//     mapped onto the EmAI palette by colour value, not by upstream class names.
//  4. Head merge: tenant head entries replace upstream entries with the same key; upstream
//     entries without a tenant counterpart are kept (unless they carry Bootstrap branding).
//  5. Override drift check (brand/overrides.json): tenant files that shadow upstream files record
//     the upstream blob hash they were written against; a changed upstream file is reported.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { addVitePlugin, defineNuxtModule } from "@nuxt/kit";

const require = createRequire(import.meta.url);
const { recolorSource } = require("./recolor.cjs");
const { patchSource, checkPatches, checkOverrides } = require("./core.cjs");

const here = fileURLToPath(new URL(".", import.meta.url));
const tenantRoot = join(here, "..");

type HeadEntry = Record<string, any>;
export interface EmaiBrandOptions {
  upstream: string;
  head?: { meta?: HeadEntry[]; link?: HeadEntry[]; title?: string; htmlAttrs?: Record<string, any> };
}

const LOCALES: Record<string, string> = {
  "locales/de.json": "locales/de.json",
  "locales/en-US.json": "locales/en-US.json",
};
const RECOLOR_DIRS = /^(components|pages|layouts|assets|composables|utils|plugins)\//;
const RECOLOR_EXT = /\.(vue|css|ts|js)$/;

function deepMerge(base: any, over: any): any {
  if (Array.isArray(over) || typeof over !== "object" || over === null) return over;
  const out: any = { ...(typeof base === "object" && base && !Array.isArray(base) ? base : {}) };
  for (const [k, v] of Object.entries(over)) out[k] = deepMerge(out[k], v);
  return out;
}

function headKey(kind: "meta" | "link", e: HeadEntry): string | undefined {
  if (kind === "meta") {
    if (e.charset) return "charset";
    for (const k of ["name", "property", "http-equiv", "itemprop"]) if (e[k]) return `${k}:${e[k]}`;
    return undefined;
  }
  if (["icon", "apple-touch-icon", "manifest", "canonical"].includes(e.rel)) return `rel:${e.rel}:${e.type ?? ""}:${e.sizes ?? ""}`;
  return undefined;
}

function mergeHead(kind: "meta" | "link", merged: HeadEntry[] = [], tenant: HeadEntry[] = []) {
  const tenantKeys = new Set(tenant.map((e) => headKey(kind, e)).filter(Boolean));
  const tenantIcons = kind === "link" && tenant.some((e) => /icon/.test(e.rel));
  const dropped: HeadEntry[] = [];
  const kept = merged.filter((e) => {
    if (tenant.includes(e)) return false;
    const key = headKey(kind, e);
    if (key && tenantKeys.has(key)) return false;
    if (tenantIcons && /icon|manifest/.test(e.rel ?? "")) return false;
    if (/bootstrap/i.test(JSON.stringify(e))) {
      dropped.push(e);
      return false;
    }
    return true;
  });
  return { list: [...tenant, ...kept], dropped };
}

export default defineNuxtModule<EmaiBrandOptions>({
  meta: { name: "emai-brand", configKey: "emaiBrand" },
  setup(options, nuxt) {
    const upstream = options.upstream;
    const log = (msg: string) => console.log(`\x1b[38;5;208m[emai-brand]\x1b[0m ${msg}`);
    const fail = (title: string, problems: string[]) => {
      const msg = `${title}\n  - ${problems.join("\n  - ")}`;
      if (nuxt.options.dev) console.error(`\x1b[31m[emai-brand] ${msg}\x1b[0m`);
      else throw new Error(`[emai-brand] ${msg}`);
    };

    // --- checks -------------------------------------------------------------------------
    const patchProblems = checkPatches(upstream);
    if (patchProblems.length) fail("upstream patches no longer apply (update brand/patches.cjs):", patchProblems);
    const drift = checkOverrides(upstream);
    if (drift.length) {
      // Not fatal: the override still works, but someone has to look at the upstream change.
      console.warn(
        `\x1b[33m[emai-brand] ${drift.length} tenant override(s) shadow upstream files that changed. ` +
          `Review them, then run scripts/check-upstream.sh --update:\n  - ${drift.join("\n  - ")}\x1b[0m`
      );
    } else log("patches apply, overrides match upstream");

    // --- head -------------------------------------------------------------------------------
    const head = options.head ?? {};
    const h = nuxt.options.app.head as any;
    if (head.title) h.title = head.title;
    if (head.htmlAttrs) h.htmlAttrs = { ...(h.htmlAttrs || {}), ...head.htmlAttrs };
    for (const kind of ["meta", "link"] as const) {
      const { list, dropped } = mergeHead(kind, h[kind], head[kind]);
      h[kind] = list;
      if (dropped.length) log(`head: dropped ${dropped.length} Bootstrap-branded upstream ${kind} entr${dropped.length > 1 ? "ies" : "y"}`);
    }

    // --- vite transform -------------------------------------------------------------------
    const upstreamPrefix = upstream.endsWith(sep) ? upstream : upstream + sep;
    addVitePlugin({
      name: "emai-brand",
      enforce: "pre",
      transform(code: string, id: string) {
        const [file, query = ""] = id.split("?");
        if (!file.startsWith(upstreamPrefix) || file.includes(`${sep}node_modules${sep}`)) return null;
        const rel = relative(upstream, file).split(sep).join("/");

        if (LOCALES[rel] && !query) {
          const tenantFile = join(tenantRoot, LOCALES[rel]);
          this.addWatchFile(tenantFile);
          const merged = deepMerge(JSON.parse(code), JSON.parse(readFileSync(tenantFile, "utf8")));
          return { code: JSON.stringify(merged), map: null };
        }

        let out = code;
        // Sub-requests of an SFC (?vue&type=...) come from the already patched main request,
        // except <style src="..."> blocks, which plugin-vue reads from disk.
        const isSfcPart = query.includes("vue") && !query.includes("src");
        if (!isSfcPart) out = patchSource(rel, out);
        if (RECOLOR_DIRS.test(rel) && RECOLOR_EXT.test(file)) out = recolorSource(out);
        return out === code ? null : { code: out, map: null };
      },
    });
  },
});

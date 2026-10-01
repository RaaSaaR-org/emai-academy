// EmAI Academy: shared logic of the brand module (brand/module.ts) and scripts/check-upstream.sh.
"use strict";
const { createHash } = require("node:crypto");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const patchSpec = require("./patches.cjs");

const toRegex = (find) =>
  find instanceof RegExp
    ? new RegExp(find.source, find.flags.includes("g") ? find.flags : find.flags + "g")
    : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

/** Apply targeted then global patches to an upstream file's source (rel = path from upstream root). */
function patchSource(rel, code) {
  let out = code;
  for (const p of patchSpec.patches) if (p.file === rel) out = out.replace(toRegex(p.find), p.replace);
  if (!patchSpec.excludeFiles.some((re) => re.test(rel))) {
    for (const g of patchSpec.global) out = out.split(g.find).join(g.replace);
  }
  return out;
}

/** Verify every targeted patch still matches upstream. Returns human-readable problems. */
function checkPatches(upstream) {
  const problems = [];
  for (const p of patchSpec.patches) {
    const file = join(upstream, p.file);
    if (!existsSync(file)) {
      problems.push(`${p.file}: file is gone upstream (patch: ${p.why})`);
      continue;
    }
    const n = (readFileSync(file, "utf8").match(toRegex(p.find)) || []).length;
    const want = p.count ?? 1;
    if (n !== want) problems.push(`${p.file}: expected ${want} match(es) of ${String(p.find)}, found ${n} (patch: ${p.why})`);
  }
  return problems;
}

/** git blob hash, same as `git hash-object <file>`. */
function blobHash(file) {
  const buf = readFileSync(file);
  return createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
}

const manifestPath = join(__dirname, "overrides.json");

/** Compare tenant overrides with the upstream files they shadow. */
function checkOverrides(upstream) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const problems = [];
  for (const o of manifest.overrides) {
    const up = join(upstream, o.upstream);
    if (!existsSync(up)) problems.push(`${o.file}: upstream ${o.upstream} no longer exists`);
    else if (blobHash(up) !== o.upstreamBlob)
      problems.push(`${o.file}: upstream ${o.upstream} changed since the override was written (${o.kind}; ${o.contract})`);
  }
  return problems;
}

/** Re-record the upstream blob hashes (after reviewing the upstream changes). */
function updateOverrides(upstream) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const o of manifest.overrides) {
    const up = join(upstream, o.upstream);
    if (existsSync(up)) o.upstreamBlob = blobHash(up);
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

module.exports = { patchSource, checkPatches, checkOverrides, updateOverrides, blobHash };

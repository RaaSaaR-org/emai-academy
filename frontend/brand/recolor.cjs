// EmAI Academy: map the hard-coded Bootstrap palette in upstream sources onto the EmAI palette.
//
// Upstream components hard-code navy/teal literals in scoped styles, SVG attributes and
// arbitrary Tailwind classes (bg-[#1c3250]). Instead of re-skinning those by targeting
// upstream's internal class names (fragile), the tenant rewrites the colour *values* at build
// time. The same function runs in two places, so both stay in sync:
//   - brand/module.ts: a Vite pre-transform for upstream .vue/.css/.ts sources
//   - tailwind.config.js: content.transform, so Tailwind generates the rewritten arbitrary classes
// Rules are by colour, not by file or class name, so they keep working when upstream renames
// things. The function is idempotent (EmAI colours map to themselves).
"use strict";

// Exact mappings for upstream design tokens and their most common literals.
const EXACT = {
  "0b192e": "141414", // --color-primary (page background)
  "182b45": "1f1f1f", // --color-secondary (surface)
  "0b3341": "262626", // --color-tertiary (nav, menus, borders)
  "0cc9ab": "ff6700", // --color-accent: brand action colour -> EmAI orange
  "0cab96": "e65c00", // accent hover
  // Bright teals used for primary actions, selection and progress in the learning rooms and
  // the dashboard -> orange. Darker/lighter teals (correct-answer feedback) stay teal.
  "36dfbe": "ff6700",
  "39dfbc": "ff6700",
  "42ddc3": "ff8534",
  "1c3250": "262626",
  "2d405c": "2a2a2a",
  "2e405a": "2a2a2a",
  "42546e": "3a3a3a",
  "eef2ff": "f5f5f4",
  "edf3fb": "f5f5f4",
  "adbdce": "a8a29e",
};

// EmAI palette: never touched.
const KEEP = new Set(["141414", "1f1f1f", "262626", "ff6700", "2dd4bf", "f5f5f4", "a8a29e", "ff8534", "e65c00"]);

const TEAL_HUE = 173; // EmAI teal #2DD4BF
const STONE_HUE = 28; // EmAI stone greys (#A8A29E)

function hexToRgb(h) {
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function rgbToHex([r, g, b]) {
  return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb([h, s, l]) {
  h /= 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Map one 6-digit lowercase hex (no '#') to the EmAI palette; returns the input if untouched. */
function mapHex(hex) {
  hex = hex.toLowerCase();
  if (KEEP.has(hex)) return hex;
  if (EXACT[hex]) return EXACT[hex];
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  // Navy / blue-grey family -> neutral stone of similar lightness.
  // Vivid mid-lightness blues (links, info badges) are kept.
  if (h >= 195 && h <= 250 && s >= 0.1 && !(s > 0.75 && l > 0.35 && l < 0.65)) {
    const nl = l < 0.3 ? Math.max(0.06, l * 0.9) : l;
    const ns = l < 0.3 ? 0 : 0.05;
    return rgbToHex(hslToRgb([STONE_HUE, ns, nl]));
  }
  // Teal family -> EmAI teal hue (same saturation and lightness).
  if (h >= 155 && h <= 190 && s >= 0.3 && Math.abs(h - TEAL_HUE) > 1.5) {
    return rgbToHex(hslToRgb([TEAL_HUE, s, l]));
  }
  return hex;
}

const HEX_RE = /(^|[^\w&#])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*[\d.]+\s*)?\)/g;

/** Rewrite every colour literal in a source string. Returns the same string when nothing changed. */
function recolorSource(src) {
  let out = src.replace(HEX_RE, (m, pre, hex) => {
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    const mapped = mapHex(full);
    if (mapped === full.toLowerCase()) return m;
    return `${pre}#${mapped}`;
  });
  out = out.replace(RGB_RE, (m, r, g, b, alpha) => {
    const hex = rgbToHex([+r, +g, +b]);
    const mapped = mapHex(hex);
    if (mapped === hex) return m;
    const [nr, ng, nb] = hexToRgb(mapped);
    return alpha ? `rgba(${nr}, ${ng}, ${nb}${alpha.replace(/\s+$/, "")})` : `rgb(${nr}, ${ng}, ${nb})`;
  });
  return out;
}

module.exports = { mapHex, recolorSource };

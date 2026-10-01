/** @type {import('tailwindcss').Config} */
// Extends the upstream Tailwind config: same tokens (all CSS variables), content globs
// re-pointed to tenant + upstream sources, and EmAI font utilities appended last so they win.
const path = require("node:path");
const plugin = require("tailwindcss/plugin");
const base = require("../../frontend/tailwind.config.js");
// Same colour mapping the brand module applies to upstream sources, so rewritten arbitrary
// classes (bg-[#1c3250] -> bg-[#262626]) are generated too.
const { recolorSource } = require("./brand/recolor.cjs");

const here = __dirname;
const up = path.resolve(here, "../../frontend");
const globs = [
  "components/**/*.{js,vue,ts}",
  "layouts/**/*.vue",
  "pages/**/*.vue",
  "plugins/**/*.{js,ts}",
  "composables/**/*.{js,ts}",
  "utils/**/*.{js,ts}",
  "app.vue",
  "error.vue",
  "nuxt.config.{js,ts}",
];

const heading = '"Space Grotesk", "Space Grotesk Fallback", system-ui, sans-serif';
const body = 'Geist, "Geist Fallback", system-ui, -apple-system, "Segoe UI", sans-serif';
const mono = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

module.exports = {
  ...base,
  content: {
    files: globs.flatMap((g) => [path.join(here, g), path.join(up, g)]),
    transform: { vue: recolorSource, ts: recolorSource, js: recolorSource },
  },
  theme: {
    ...base.theme,
    extend: {
      ...(base.theme.extend || {}),
      fontFamily: { display: [heading], sans: [body], mono: [mono] },
    },
  },
  plugins: [
    ...base.plugins,
    plugin(({ addUtilities, addComponents }) => {
      addUtilities({
        ".font-heading": { fontFamily: heading },
        ".font-body": { fontFamily: body },
      });
      addComponents({
        ".text-subheading-1": { fontFamily: mono },
        ".text-subheading-2": { fontFamily: mono },
      });
    }),
  ],
};

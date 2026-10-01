// EmAI Academy: tenant layer over the Bootstrap Academy frontend.
// Everything here only overrides; the upstream repo at ../../frontend stays untouched.
import { fileURLToPath } from "node:url";
import emaiBrand from "./brand/module";

const upstream = fileURLToPath(new URL("../../frontend", import.meta.url));
const tailwindConfig = fileURLToPath(new URL("./tailwind.config.js", import.meta.url));

const description =
  "EmAI Academy: Physical AI lernen, herstellerunabhängig und praxisnah. Von EmAI Robotics, Saarbrücken.";

const head = {
  title: "EmAI Academy",
  htmlAttrs: { lang: "de", class: "emai" },
  link: [
    { rel: "icon", href: "/favicon.ico", sizes: "any" },
    { rel: "icon", type: "image/svg+xml", href: "/brand/emai-icon-v2.svg" },
    { rel: "apple-touch-icon", href: "/brand/emai-apple-touch-v2.png" },
    { rel: "manifest", href: "/manifest.webmanifest" },
    { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/space-grotesk-latin.woff2", crossorigin: "" },
    { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/geist-latin.woff2", crossorigin: "" },
  ],
  // Same keys as upstream entries replace them; upstream entries without a tenant counterpart stay.
  meta: [
    { charset: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#141414" },
    { name: "color-scheme", content: "dark" },
    { name: "description", content: description },
    { property: "name", content: "EmAI Academy" },
    { property: "description", content: description },
    { property: "image", content: "/og-image.png" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "EmAI Academy" },
    { property: "og:title", content: "EmAI Academy: Physical AI lernen" },
    { property: "og:description", content: description },
    { property: "og:image", content: "/og-image.png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "EmAI Academy" },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: "/og-image.png" },
  ],
};

// Routes of Bootstrap-only features (shop, premium, challenges, webinars, commerce legal, dev pages).
// They are removed from the router; middleware/emai-features.global.ts redirects old deep links.
export const EMAI_PRUNED_ROUTES =
  /^\/(morphcoins|subscription|webinars|calendar|orders|challenges|vertrag-|dev(\/|$)|profile\/challenges|docs\/right-of-withdrawal|docs\/terms-and-conditions-2026)/;

export default defineNuxtConfig({
  extends: [upstream],

  devServer: { port: 3001, host: "localhost" },

  // All changes to upstream *sources* (locale merge, patches, recolor, head merge, override
  // drift check) go through brand/module.ts. See brand/README.md.
  modules: [[emaiBrand, { upstream, head }]],

  hooks: {
    // Drop the page components of Bootstrap-only features and keep a plain redirect
    // record per path, so old links land on /dashboard without "no match" router warnings.
    "pages:extend"(pages) {
      const join = (a: string, b: string) => (b.startsWith("/") ? b : `${a.replace(/\/$/, "")}/${b}`);
      const flatten = (list: typeof pages, parent = ""): string[] =>
        list.flatMap((p) => [join(parent, p.path), ...flatten(p.children ?? [], join(parent, p.path))]);
      for (let i = pages.length - 1; i >= 0; i--) {
        if (!EMAI_PRUNED_ROUTES.test(pages[i].path)) continue;
        const [removed] = pages.splice(i, 1);
        for (const path of new Set(flatten([removed]))) {
          pages.push({ path, redirect: "/dashboard" } as any);
        }
      }
    },
  },

  // Tailwind reads its config from the cwd by default; pin it so builds do not depend on cwd.
  postcss: {
    plugins: {
      tailwindcss: { config: tailwindConfig },
      autoprefixer: {},
    },
  },

  runtimeConfig: {
    public: {
      BASE_API_URL: "http://127.0.0.1:8191",
      BASE_WEB_URL: "http://localhost:3001",
      NODE_ENV: "development",
      learningRoomsEnabled: true,
      emaiDefaultLearningPath: "physical-ai-grundlagen",
    },
  },
});

// Brand-leak check: open pages (logged in and/or out) and report Bootstrap leftovers.
//   node brand-check.mjs [--login user:pass] [--shots prefix] /path1 /path2 ...
// Per page it reports: "bootstrap" in visible text or in the DOM (href/mailto), the number of
// elements whose computed colour is in the upstream navy family, and console errors.
// Exit code 1 if any page leaks. Screenshots go to ../screens/<prefix><path>.png.
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
let login = null, prefix = null;
const paths = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--login") login = args[++i];
  else if (args[i] === "--shots") prefix = args[++i];
  else paths.push(args[i]);
}
const BASE = process.env.EMAI_WEB || "http://localhost:3001";
const SCREENS = new URL("../screens/", import.meta.url).pathname;

const b = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));

if (login) {
  const [u, pw] = login.split(":");
  await p.goto(BASE + "/auth/login", { waitUntil: "networkidle2" });
  await p.type("input[type=text]", u);
  await p.type("input[type=password]", pw);
  await p.click("form button[type=submit]");
  await p.waitForFunction(() => !location.pathname.startsWith("/auth/login"), { timeout: 20000 });
}

let leaks = 0;
for (const path of paths) {
  errors.length = 0;
  await p.goto(BASE + path, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1500));
  const r = await p.evaluate(() => {
    const text = document.body.innerText;
    const html = document.documentElement.outerHTML;
    // The footer credit "auf Basis der Open-Source-Plattform Bootstrap Academy" is deliberate.
    const textHits = [...text.matchAll(/.{0,50}bootstrap.{0,50}/gi)]
      .map((m) => m[0].replace(/\s+/g, " "))
      .filter((h) => !/Open-Source-(Plattform|platform) Bootstrap Academy/i.test(h));
    const domHits = [...html.matchAll(/[^"'<> ]*bootstrap\.academy[^"'<> ]*/gi)].map((m) => m[0]);
    // navy family: hue 195-250, saturation >= 0.25, any lightness < 0.5
    const navy = (c) => {
      const m = c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
      if (!m || (m[4] !== undefined && +m[4] === 0)) return false;
      let [r, g, bl] = [+m[1] / 255, +m[2] / 255, +m[3] / 255];
      const max = Math.max(r, g, bl), min = Math.min(r, g, bl), l = (max + min) / 2;
      if (max === min) return false;
      const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      let h = max === r ? (g - bl) / d + (g < bl ? 6 : 0) : max === g ? (bl - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
      return h >= 195 && h <= 250 && s >= 0.25 && l < 0.5;
    };
    const navyEls = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      for (const prop of ["backgroundColor", "color", "borderTopColor", "fill"]) {
        if (prop === "borderTopColor" && cs.borderTopWidth === "0px") continue;
        if (navy(cs[prop])) {
          navyEls.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join(".")} ${prop}=${cs[prop]}`);
          break;
        }
      }
    }
    return { url: location.pathname, textHits, domHits: [...new Set(domHits)], navyEls };
  });
  const leak = r.textHits.length + r.domHits.length + r.navyEls.length;
  leaks += leak;
  console.log(`${leak ? "LEAK" : "ok  "} ${path} -> ${r.url}  text:${r.textHits.length} dom:${r.domHits.length} navy:${r.navyEls.length} consoleErrors:${errors.length}`);
  for (const h of r.textHits.slice(0, 5)) console.log("     text:", h);
  for (const h of r.domHits.slice(0, 5)) console.log("     dom: ", h);
  for (const h of r.navyEls.slice(0, 5)) console.log("     navy:", h);
  for (const e of errors.slice(0, 3)) console.log("     console:", e);
  if (prefix) await p.screenshot({ path: `${SCREENS}${prefix}${path.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: true });
}
await b.close();
process.exit(leaks ? 1 : 0);

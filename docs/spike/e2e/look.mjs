// Dev helper: log in as a user, open a page, print matches of a regex and save a screenshot.
// node look.mjs <path> <regex> [shot.png]   (EMAI_USER / EMAI_PASS, defaults to the frontend test user)
import puppeteer from "puppeteer-core";
const [, , target, pattern, out] = process.argv;
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
p.on("console", (m) => m.type() === "error" && console.log("console:", m.text().slice(0, 200)));
await p.goto("http://localhost:3001/auth/login", { waitUntil: "networkidle2" });
await p.type("input[type=text]", process.env.EMAI_USER || "emaifrontend");
await p.type("input[type=password]", process.env.EMAI_PASS || "EmaiTest!2026x");
await p.click("form button[type=submit]");
await p.waitForFunction(() => !location.pathname.startsWith("/auth/login"), { timeout: 20000 });
await p.goto("http://localhost:3001" + target, { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2000));
const t = await p.evaluate(() => document.body.innerText);
const re = new RegExp(pattern || "$^", "gi"); let m; while ((m = re.exec(t))) { console.log("...", t.slice(Math.max(0, m.index - 80), m.index + 80).replace(/\s+/g, " ")); if (!m[0]) break; }
if (out) await p.screenshot({ path: out });
await b.close();

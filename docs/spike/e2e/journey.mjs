// EmAI Academy end-to-end journey (spike). Drives the installed Chrome against the running
// tenant: frontend http://localhost:3001, gateway http://127.0.0.1:8191, smtp4dev http://localhost:5050.
//
//   cd docs/spike/e2e && npm install && node journey.mjs
//
// Writes screenshots to ../screens/e2e-*.png and a summary to ./last-run.json.
// Exit code 0 only if every step passed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCREENS = path.resolve(HERE, "../screens");
const WEB = process.env.EMAI_WEB || "http://localhost:3001";
const API = process.env.EMAI_API || "http://127.0.0.1:8191";
const SMTP = process.env.EMAI_SMTP_UI || "http://localhost:5050";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOMS = JSON.parse(fs.readFileSync(path.resolve(HERE, "../../../content/learning_rooms.json"), "utf8"));

const stamp = Date.now().toString(36);
const USER = { name: `e2e${stamp}`, display: "E2E Lernende", email: `e2e-${stamp}@emai.local`, password: `EmaiE2E!${stamp}` };

const results = [];
const consoleErrors = [];
const failedRequests = [];
let current = "setup";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function step(name, fn) {
  current = name;
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ step: name, ok: true, ms: Date.now() - t0, detail: detail ?? "" });
    console.log(`PASS ${name}${detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  } catch (e) {
    results.push({ step: name, ok: false, ms: Date.now() - t0, detail: String(e?.message || e) });
    console.log(`FAIL ${name}: ${e?.message || e}`);
    try { await shot(`fail-${name}`); } catch {}
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-first-run", "--no-default-browser-check", "--lang=de-DE"],
});
let page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
function wire(p) {
  p.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push({ step: current, url: p.url(), text: m.text().slice(0, 400) });
  });
  p.on("pageerror", (e) => consoleErrors.push({ step: current, url: p.url(), text: `pageerror: ${String(e).slice(0, 400)}` }));
  p.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/_nuxt/")) failedRequests.push({ step: current, status: r.status(), url: r.url() });
  });
}
wire(page);

async function shot(name, full = false) {
  const file = path.join(SCREENS, `e2e-${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  return path.basename(file);
}
async function go(url) {
  await page.goto(url.startsWith("http") ? url : WEB + url, { waitUntil: "networkidle2", timeout: 60000 });
}
// The footer credits the platform ("auf Basis der Open-Source-Plattform Bootstrap Academy") on purpose.
const stripCredit = (t) => t.replace(/(auf Basis der|based on the) open-source[- ]plattform Bootstrap Academy/gi, "");
const text = () => page.evaluate(() => document.body.innerText);
async function waitText(re, timeout = 20000) {
  await page.waitForFunction((src, flags) => new RegExp(src, flags).test(document.body.innerText), { timeout }, re.source, re.flags);
}
async function clickText(selector, re) {
  const ok = await page.evaluate((sel, src, flags) => {
    const el = [...document.querySelectorAll(sel)].find((e) => new RegExp(src, flags).test(e.innerText || e.value || "") && !e.disabled);
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    el.click();
    return true;
  }, selector, re.source, re.flags);
  assert(ok, `no clickable ${selector} matching ${re}`);
}
async function typeInto(selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value);
}

// ---------------------------------------------------------------- landing + branding
await step("landing-branding", async () => {
  await go("/");
  const t = await text();
  const title = await page.title();
  assert(/EmAI Academy/.test(title), `title is "${title}"`);
  assert(/Physical AI/.test(t), "no Physical AI copy");
  const stray = stripCredit(t);
  assert(!/Bootstrap Academy|Morphcoins/i.test(stray), "Bootstrap wording visible on landing page");
  assert(!/humanoid/i.test(t), "house style: 'humanoid' found");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await shot("01-landing");
  await shot("01-landing-full", true);
  return { title, bodyBackground: bg };
});
await step("landing-mobile", async () => {
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await go("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await shot("02-landing-mobile");
  await page.setViewport({ width: 1440, height: 900 });
  assert(overflow <= 1, `horizontal overflow ${overflow}px at 390px`);
});

// ---------------------------------------------------------------- hidden features
await step("hidden-features-redirect", async () => {
  const out = {};
  for (const p of ["/morphcoins", "/subscription", "/challenges", "/webinars", "/calendar", "/orders"]) {
    await go(p);
    const u = new URL(page.url());
    out[p] = u.pathname;
    // logged out: /dashboard itself bounces to login, both are fine
    assert(["/dashboard", "/auth/login"].includes(u.pathname), `${p} ended on ${u.pathname}`);
  }
  return out;
});

// ---------------------------------------------------------------- signup + verification
await step("signup", async () => {
  await go("/auth/signup");
  const inputs = await page.$$("form input[type=text], form input[type=email], form input[type=password]");
  assert(inputs.length >= 4, `signup form has ${inputs.length} inputs`);
  const values = [USER.name, USER.display, USER.email, USER.password];
  for (let i = 0; i < 4; i++) { await inputs[i].click({ clickCount: 3 }); await inputs[i].type(values[i]); }
  for (const id of ["TermsAndConditions", "MinimumAge"]) {
    await page.evaluate((i) => { const c = document.getElementById(i); if (!c.checked) c.click(); }, id);
  }
  await shot("03-signup-filled");
  await clickText("form button[type=submit], button", /account erstellen|create account/i);
  await waitText(/Registrierung erfolgreich|Registration successful/i, 20000);
  await sleep(500);
  await shot("04-after-signup");
  await clickText("button", /konto verifizieren|verify account/i);
  await page.waitForFunction(() => location.pathname.startsWith("/auth/verify-account"), { timeout: 20000 });
  return { user: USER.name, email: USER.email, landedOn: new URL(page.url()).pathname };
});

let code = "";
await step("verification-mail", async () => {
  let msg;
  for (let i = 0; i < 30 && !msg; i++) {
    const list = await (await fetch(`${SMTP}/api/messages?pageSize=50`)).json();
    msg = list.results.find((m) => m.to.includes(USER.email));
    if (!msg) await sleep(1000);
  }
  assert(msg, "no mail for the new user in smtp4dev");
  const html = await (await fetch(`${SMTP}/api/messages/${msg.id}/html`)).text();
  code = (html.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/) || [])[0] || "";
  assert(code, "no verification code in mail");
  // services/mail-relay re-brands the backend's compiled-in Bootstrap templates
  assert(!/bootstrap/i.test(msg.subject + html), "verification mail still mentions Bootstrap");
  assert(/EmAI Academy/.test(msg.subject) && /EmAI Robotics GmbH/.test(html), "verification mail is not EmAI-branded");
  return { subject: msg.subject, from: msg.from, code };
});

await step("verify-account", async () => {
  if (!new URL(page.url()).pathname.startsWith("/auth/verify-account")) await go("/auth/verify-account");
  if (new URL(page.url()).pathname.startsWith("/auth/login")) {
    await login();
    await go("/auth/verify-account");
  }
  const input = await page.waitForSelector("form input[type=text], form input:not([type])", { visible: true });
  await input.click({ clickCount: 3 });
  await input.type(code);
  await clickText("form button", /.+/);
  await waitText(/Willkommen|Welcome|Dashboard/i, 20000);
  await sleep(800);
  await shot("05-verified");
  const me = await apiAsUser("/auth/users/me");
  assert(me?.email_verified === true, `email_verified=${me?.email_verified}`);
  return "email_verified=true";
});

async function login() {
  await go("/auth/login");
  await typeInto("input[type=text]", USER.name);
  await typeInto("input[type=password]", USER.password);
  await clickText("form button[type=submit]", /login|anmelden/i);
  await page.waitForFunction(() => !location.pathname.startsWith("/auth/login"), { timeout: 20000 });
}
async function token() {
  const cookies = await page.cookies(WEB);
  const c = cookies.find((x) => /accessToken/i.test(x.name));
  return c ? decodeURIComponent(c.value).replace(/^"|"$/g, "") : "";
}
async function apiAsUser(p) {
  const t = await token();
  const r = await fetch(API + p, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  return r.ok ? r.json() : { status: r.status };
}

// ---------------------------------------------------------------- login (fresh page, real form)
await step("login", async () => {
  await page.close();
  const ctx = await browser.createBrowserContext(); // fresh cookie jar: real login through the form
  page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  wire(page);
  await login();
  await sleep(1000);
  await shot("06-after-login");
  assert(await token(), "no access token cookie after login");
  return { landedOn: new URL(page.url()).pathname };
});

// ---------------------------------------------------------------- dashboard
await step("dashboard-learning-rooms", async () => {
  await go("/dashboard");
  await sleep(1500);
  const t = await text();
  assert(!/Bootstrap Academy|Morphcoins|Premium/i.test(stripCredit(t)), "Bootstrap wording on dashboard");
  const caps = await apiAsUser("/skills/rooms/capabilities");
  assert(caps?.enabled === true, "rooms capability not enabled");
  await shot("07-dashboard");
  await shot("07-dashboard-full", true);
  const hasRoomsEntry = /Lernr(a|ä)um|Üben|Learning room|Practice|Weiter ?lernen|Continue/i.test(t);
  return { roomsCapability: caps, roomsEntryVisible: hasRoomsEntry, excerpt: t.slice(0, 300).replace(/\s+/g, " ") };
});

await step("dashboard-practice-button", async () => {
  await go("/dashboard");
  await page.waitForSelector(".practice-button", { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector(".practice-button")?.disabled, { timeout: 20000 });
  await page.click(".practice-button");
  await page.waitForFunction(() => location.pathname === "/learn" && location.search.includes("path="), { timeout: 20000 });
  await roomUnitId();
  await sleep(500);
  const t = await text();
  assert(!/konnte nicht geladen|could not be loaded|nicht verfügbar|unavailable/i.test(t), "learn page shows an error");
  await shot("07b-dashboard-practice-learn");
  const u = new URL(page.url());
  return { url: u.pathname + u.search };
});

// ---------------------------------------------------------------- skill tree
await step("skill-tree", async () => {
  await go("/skill-tree");
  await sleep(2500);
  const tree = await (await fetch(`${API}/skills/skilltree`)).json();
  assert(tree.skills.length === 9, `${tree.skills.length} root skills`);
  const edges = tree.skills.reduce((n, s) => n + s.dependencies.length, 0);
  const t = await text();
  const names = tree.skills.map((s) => s.name);
  // node labels are rendered with text-transform: capitalize
  const lower = t.toLowerCase();
  const visible = names.filter((n) => lower.includes(n.toLowerCase()));
  const svgLines = await page.evaluate(() => document.querySelectorAll("svg line, svg path, svg polyline").length);
  await shot("08-skill-tree");
  assert(visible.length === 9, `only ${visible.length}/9 skill names visible: missing ${names.filter((n) => !visible.includes(n)).join(", ")}`);
  return { apiEdges: edges, visibleSkills: visible.length, svgStrokes: svgLines };
});

await step("skill-subtree", async () => {
  await go("/skill-tree/physical_ai_grundlagen");
  await sleep(2000);
  await shot("09-skill-subtree");
  const t = await text();
  assert(/Physical AI in acht Kapiteln|Begriffe der Physical AI/i.test(t), "sub-skills not visible");
});

// ---------------------------------------------------------------- course
await step("course-page", async () => {
  await go("/courses/physical-ai-grundlagen");
  await sleep(1500);
  const t = await text();
  await shot("10-course");
  await shot("10-course-full", true);
  assert(/Physical AI/.test(t), "course title not visible");
  return { path: new URL(page.url()).pathname };
});

// ---------------------------------------------------------------- learning room: guided lesson
const unitById = Object.fromEntries(ROOMS.units.map((u) => [u.id, u]));
async function roomUnitId() {
  await page.waitForSelector(".learning-room, .room-state", { timeout: 30000 });
  return page.evaluate(() => document.querySelector(".learning-room h1")?.innerText || "");
}
async function solveGuided(unit, shotPrefix) {
  const steps = unit.content.de.steps;
  let shotTaken = false;
  for (let i = 0; i < steps.length; i++) {
    await page.waitForSelector(".guided-lesson h2", { timeout: 20000 });
    const s = steps[i];
    if (s.check) {
      const wrong = s.check.options.find((o) => o.value !== s.check.answer);
      if (i === 1 && wrong) {
        await page.click(`.understanding-check input[value="${wrong.value}"]`);
        await page.click(".understanding-check button[type=submit]");
        await page.waitForSelector(".check-feedback");
        if (shotPrefix) await shot(`${shotPrefix}-try-again`);
      }
      await page.click(`.understanding-check input[value="${s.check.answer}"]`);
      await page.click(".understanding-check button[type=submit]");
      await page.waitForSelector(".check-feedback.correct", { timeout: 10000 });
      if (shotPrefix && !shotTaken) { await shot(`${shotPrefix}-correct`); shotTaken = true; }
    }
    if (s.experiment) {
      await page.evaluate((v) => {
        const r = document.querySelector(".experiment input[type=range]");
        r.value = String(v); r.dispatchEvent(new Event("input", { bubbles: true }));
      }, s.experiment.max);
    }
    await page.waitForSelector(".next-action:not([disabled])", { timeout: 10000 });
    await page.click(".next-action");
    await sleep(350);
  }
  await page.waitForSelector(".finished-room", { timeout: 20000 });
}

await step("learn-default-path", async () => {
  await go("/learn");
  await page.waitForFunction(() => location.search.includes("path="), { timeout: 15000 });
  const u = new URL(page.url());
  await roomUnitId();
  await shot("11-learn-start");
  const t = await text();
  assert(!/konnte nicht geladen|could not be loaded/i.test(t), "learn page shows load error");
  return { url: u.pathname + u.search };
});

await step("guided-lesson-complete", async () => {
  await go("/learn?path=physical-ai-grundlagen&course=physical-ai-grundlagen&unit=pai-was-ist-physical-ai");
  const title = await roomUnitId();
  assert(/KI mit Körper/.test(title), `unexpected room "${title}"`);
  await shot("12-guided-lesson");
  await solveGuided(unitById["pai-was-ist-physical-ai"], "13-guided");
  await shot("14-guided-finished");
  const t = await apiAsUser("/skills/rooms?path=physical-ai-grundlagen&course=physical-ai-grundlagen&unit=pai-was-ist-physical-ai");
  assert(t?.next?.progress?.status === "completed", `progress ${JSON.stringify(t?.next?.progress)}`);
  return { status: t.next.progress.status, result: t.next.progress.result };
});

await step("knowledge-check-exercise", async () => {
  // Final knowledge check of the Decider path: 5 graded questions, no skip allowed.
  const unit = unitById["pai-wissenscheck"];
  await go("/learn?path=physical-ai-grundlagen&course=physical-ai-grundlagen&unit=pai-wissenscheck");
  const title = await roomUnitId();
  const blocked = await page.$(".guided-lesson") === null;
  if (blocked) { await shot("15-knowledge-check-blocked"); throw new Error(`knowledge check not open: "${title}" ${(await text()).slice(0, 200)}`); }
  await solveGuided(unit, "15-knowledge-check");
  await shot("16-knowledge-check-finished");
  const t = await apiAsUser("/skills/rooms?path=physical-ai-grundlagen&course=physical-ai-grundlagen&unit=pai-wissenscheck");
  assert(t?.next?.progress?.status === "completed", `progress ${JSON.stringify(t?.next?.progress)}`);
  return { status: t.next.progress.status };
});

// ---------------------------------------------------------------- custom modules
async function moduleShadow() {
  await page.waitForFunction(() => {
    const s = document.querySelector(".module-surface");
    if (!s) return false;
    const host = [s, ...s.querySelectorAll("*")].find((e) => e.shadowRoot);
    return host && host.shadowRoot.childElementCount > 0;
  }, { timeout: 30000 });
  return page.evaluateHandle(() => {
    const s = document.querySelector(".module-surface");
    return [s, ...s.querySelectorAll("*")].find((e) => e.shadowRoot).shadowRoot;
  });
}

await step("module-robot-arm-kinematics", async () => {
  await go("/learn?path=so101-lerobot-setup&course=so101-lerobot-setup&unit=so101-kinematik");
  await roomUnitId();
  const shadow = await moduleShadow();
  await sleep(500);
  await shot("17-module-robot-arm");
  const n = await shadow.evaluate((s) => s.querySelectorAll("input[type=range]").length);
  assert(n >= 3, `robot arm module mounted but has ${n} sliders`);
  await shadow.evaluate(async (s) => {
    const fire = (node, type) => node.dispatchEvent(new Event(type, { bubbles: true }));
    const sliders = [...s.querySelectorAll("input[type=range]")];
    const set = async (a) => { for (let i = 0; i < 3; i++) { sliders[i].value = String(a[i]); fire(sliders[i], "input"); fire(sliders[i], "change"); await new Promise((r) => setTimeout(r, 30)); } };
    await set([66, -95, 29]);
    await set([69, -87, -72]);
    await new Promise((r) => setTimeout(r, 100));
    s.querySelector("button.primary").click();
  });
  await page.waitForSelector(".finished-room", { timeout: 20000 });
  await shot("18-module-robot-arm-finished");
  const t = await apiAsUser("/skills/rooms?path=so101-lerobot-setup&course=so101-lerobot-setup&unit=so101-kinematik");
  assert(t?.next?.progress?.status === "completed", `progress ${JSON.stringify(t?.next?.progress)}`);
  return { sliders: n, status: t.next.progress.status };
});

await step("module-teleop-dataset-explorer", async () => {
  await go("/learn?path=lerobot-datensaetze&course=lerobot-datensaetze&unit=ds-episode-lesen");
  await roomUnitId();
  const shadow = await moduleShadow();
  await sleep(500);
  await shadow.evaluate((s) => { const r = s.querySelector("input[type=range]"); r.value = "90"; r.dispatchEvent(new Event("input", { bubbles: true })); });
  await shot("19-module-teleop-explorer");
  await shadow.evaluate((s) => {
    const fire = (n, t) => n.dispatchEvent(new Event(t, { bubbles: true }));
    const pick = (name, value) => { const r = s.querySelector(`input[name=${name}][value="${value}"]`); r.checked = true; fire(r, "change"); };
    pick("fps", 30); pick("lagging_joint", "elbow_flex"); pick("gripper_gap", "contact");
    s.querySelector("form").requestSubmit();
  });
  await page.waitForSelector(".finished-room", { timeout: 20000 });
  await shot("20-module-teleop-finished");
  const t = await apiAsUser("/skills/rooms?path=lerobot-datensaetze&course=lerobot-datensaetze&unit=ds-episode-lesen");
  assert(t?.next?.progress?.status === "completed", `progress ${JSON.stringify(t?.next?.progress)}`);
  return { status: t.next.progress.status };
});

await step("course-progress", async () => {
  await go("/courses/physical-ai-grundlagen");
  await sleep(1500);
  const t = await text();
  await shot("20b-course-progress");
  const m = t.match(/(\d+)\s*\/\s*(\d+)\s*(erledigt|done|completed)/i);
  assert(m && Number(m[1]) >= 2, `course progress not updated: ${m ? m[0] : "no progress text"}`);
  return m[0];
});

// Completed room units award XP through the tenant xp-bridge (services/xp-bridge), so the
// dashboard and the skill tree reflect room work (upstream rooms grant no XP).
await step("room-xp-on-dashboard", async () => {
  const me = await apiAsUser("/auth/users/me");
  let xp = { total_xp: 0 };
  for (let i = 0; i < 15 && !(xp.total_xp > 0); i++) {
    await sleep(1000);
    xp = await apiAsUser(`/skills/xp/${me.id}`);
  }
  assert(xp.total_xp > 0, `no XP after completing rooms: ${JSON.stringify(xp).slice(0, 200)}`);
  await go("/dashboard");
  await sleep(1500);
  const t = await text();
  await shot("20c-dashboard-xp");
  assert(new RegExp(`\\b${xp.total_xp.toLocaleString("de-DE").replace(".", "\\.?")}\\s*XP`).test(t), `dashboard does not show ${xp.total_xp} XP`);
  assert(!/Dein erster Schritt zählt|Ihr erster Schritt zählt/.test(t), "dashboard still shows the empty state");
  return { total_xp: xp.total_xp, level: xp.total_level };
});

// ---------------------------------------------------------------- hidden features (logged in)
await step("hidden-features-redirect-logged-in", async () => {
  const out = {};
  for (const p of ["/morphcoins", "/subscription", "/challenges", "/webinars", "/orders"]) {
    await go(p);
    out[p] = new URL(page.url()).pathname;
    assert(out[p] === "/dashboard", `${p} ended on ${out[p]}`);
  }
  return out;
});

await step("english-locale", async () => {
  await go("/");
  await clickText("button", /^EN$/);
  await sleep(800);
  const t = await text();
  await shot("21-landing-en");
  assert(/Learn|learning/i.test(t), "no English copy after switching");
});

await browser.close();
const summary = {
  when: new Date().toISOString(),
  user: USER,
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  results,
  consoleErrors,
  failedRequests,
};
fs.writeFileSync(path.join(HERE, "last-run.json"), JSON.stringify(summary, null, 2));
console.log(`\n${summary.passed} passed, ${summary.failed} failed; ${consoleErrors.length} console errors, ${failedRequests.length} failed requests (see last-run.json)`);
process.exit(summary.failed ? 1 : 0);

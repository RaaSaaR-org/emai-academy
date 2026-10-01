// EmAI Academy full course run (spike). A brand-new learner signs up, verifies the e-mail,
// logs in and then works through every course in the browser, following the player's own
// "Weiter" button from unit to unit. After each course it validates progress in the API,
// the course page counter and growing XP; at the end the dashboard XP and skill tree.
//
//   cd docs/spike/e2e && node course-run.mjs            # all courses
//   COURSES=physical-ai-grundlagen,so101-lerobot-setup node course-run.mjs
//
// Writes ./course-run.json and screenshots to ../screens/run-*.png. Exit 0 only if all passed.
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
const unitsOf = (p) => ROOMS.units.filter((u) => u.path_id === p && !u.retired);
const COURSES = (process.env.COURSES || ROOMS.paths.map((p) => p.id).join(",")).split(",").filter(Boolean);

const stamp = Date.now().toString(36);
const USER = { name: `run${stamp}`, display: "Kurs Testerin", email: `run-${stamp}@emai.local`, password: `EmaiRun!7${stamp}` };

const results = [];
const consoleErrors = [];
const failedRequests = [];
let current = "setup";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) { if (!cond) throw new Error(msg); }
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

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-first-run", "--lang=de-DE"] });
let page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
function wire(p) {
  p.on("console", (m) => { if (m.type() === "error") consoleErrors.push({ step: current, url: p.url(), text: m.text().slice(0, 400) }); });
  p.on("pageerror", (e) => consoleErrors.push({ step: current, url: p.url(), text: `pageerror: ${String(e).slice(0, 400)}` }));
  p.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/_nuxt/")) failedRequests.push({ step: current, status: r.status(), url: r.url() }); });
}
wire(page);

const shot = (name, full = false) => page.screenshot({ path: path.join(SCREENS, `run-${name}.png`), fullPage: full });
const go = (u) => page.goto(u.startsWith("http") ? u : WEB + u, { waitUntil: "networkidle2", timeout: 60000 });
const text = () => page.evaluate(() => document.body.innerText);
const waitText = (re, timeout = 20000) =>
  page.waitForFunction((s, f) => new RegExp(s, f).test(document.body.innerText), { timeout }, re.source, re.flags);
async function clickText(selector, re) {
  const ok = await page.evaluate((sel, s, f) => {
    const el = [...document.querySelectorAll(sel)].find((e) => new RegExp(s, f).test(e.innerText || e.value || "") && !e.disabled);
    if (!el) return false;
    el.scrollIntoView({ block: "center" }); el.click(); return true;
  }, selector, re.source, re.flags);
  assert(ok, `no clickable ${selector} matching ${re}`);
}
async function typeInto(sel, v) { await page.waitForSelector(sel, { visible: true }); await page.click(sel, { clickCount: 3 }); await page.type(sel, v); }
async function token() {
  const c = (await page.cookies(WEB)).find((x) => /accessToken/i.test(x.name));
  return c ? decodeURIComponent(c.value).replace(/^"|"$/g, "") : "";
}
async function api(p) {
  const t = await token();
  const r = await fetch(API + p, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  return r.ok ? r.json() : { status: r.status };
}
async function login() {
  await go("/auth/login");
  await typeInto("input[type=text]", USER.name);
  await typeInto("input[type=password]", USER.password);
  await clickText("form button[type=submit]", /login|anmelden/i);
  await page.waitForFunction(() => !location.pathname.startsWith("/auth/login"), { timeout: 20000 });
}

// ------------------------------------------------------------------ account
await step("signup", async () => {
  await go("/auth/signup");
  const inputs = await page.$$("form input[type=text], form input[type=email], form input[type=password]");
  const values = [USER.name, USER.display, USER.email, USER.password];
  for (let i = 0; i < 4; i++) { await inputs[i].click({ clickCount: 3 }); await inputs[i].type(values[i]); }
  for (const id of ["TermsAndConditions", "MinimumAge"]) await page.evaluate((i) => { const c = document.getElementById(i); if (!c.checked) c.click(); }, id);
  await clickText("form button[type=submit], button", /account erstellen|create account/i);
  await waitText(/Registrierung erfolgreich|Registration successful/i);
  await clickText("button", /konto verifizieren|verify account/i);
  await page.waitForFunction(() => location.pathname.startsWith("/auth/verify-account"), { timeout: 20000 });
  return USER.name;
});
await step("verify-email", async () => {
  let msg;
  for (let i = 0; i < 30 && !msg; i++) {
    const list = await (await fetch(`${SMTP}/api/messages?pageSize=50`)).json();
    msg = list.results.find((m) => m.to.includes(USER.email));
    if (!msg) await sleep(1000);
  }
  assert(msg, "no verification mail");
  const html = await (await fetch(`${SMTP}/api/messages/${msg.id}/html`)).text();
  const code = (html.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/) || [])[0];
  assert(code, "no code in mail");
  await sleep(1000); // the verify page re-renders once after navigation
  const sel = "form input[type=text], form input:not([type])";
  for (let i = 0; ; i++) {
    try { await typeInto(sel, code); break; } catch (e) { if (i > 3) throw e; await sleep(700); }
  }
  await clickText("form button", /.+/);
  await waitText(/Willkommen|Welcome|Dashboard/i);
  const me = await api("/auth/users/me");
  assert(me.email_verified === true, "not verified");
  return code;
});
await step("login-fresh-session", async () => {
  await page.close();
  page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 1440, height: 900 });
  wire(page);
  await login();
  assert(await token(), "no token");
  const xp = await api(`/skills/xp/${(await api("/auth/users/me")).id}`);
  assert(!(xp.total_xp > 0), `new user already has XP ${xp.total_xp}`);
  return { landedOn: new URL(page.url()).pathname, startXp: xp.total_xp ?? 0 };
});

// ------------------------------------------------------------------ solvers per room type
async function solveGuided(unit) {
  const steps = unit.content.de.steps;
  for (let i = 0; i < steps.length; i++) {
    await page.waitForSelector(".guided-lesson h2", { timeout: 20000 });
    const s = steps[i];
    if (s.check) {
      // first answer wrong once to make sure wrong answers are rejected
      const wrong = s.check.options.find((o) => o.value !== s.check.answer);
      if (wrong) {
        await page.click(`.understanding-check input[value="${wrong.value}"]`);
        await page.click(".understanding-check button[type=submit]");
        await page.waitForSelector(".check-feedback", { timeout: 10000 });
        const correct = await page.$(".check-feedback.correct");
        assert(!correct, `wrong answer accepted in ${unit.id} step ${s.id}`);
      }
      await page.click(`.understanding-check input[value="${s.check.answer}"]`);
      await page.click(".understanding-check button[type=submit]");
      await page.waitForSelector(".check-feedback.correct", { timeout: 10000 });
    }
    if (s.experiment) {
      await page.evaluate((v) => {
        const r = document.querySelector(".experiment input[type=range]");
        r.value = String(v); r.dispatchEvent(new Event("input", { bubbles: true }));
      }, s.experiment.max);
    }
    await page.waitForSelector(".next-action:not([disabled])", { timeout: 10000 });
    await page.click(".next-action");
    await sleep(300);
  }
}
async function moduleShadow() {
  await page.waitForFunction(() => {
    const s = document.querySelector(".module-surface");
    const host = s && [s, ...s.querySelectorAll("*")].find((e) => e.shadowRoot);
    return host && host.shadowRoot.childElementCount > 0;
  }, { timeout: 30000 });
  return page.evaluateHandle(() => { const s = document.querySelector(".module-surface"); return [s, ...s.querySelectorAll("*")].find((e) => e.shadowRoot).shadowRoot; });
}
const CUSTOM = {
  "so101-kinematik": async () => {
    const sh = await moduleShadow();
    await sh.evaluate(async (s) => {
      const fire = (n, t) => n.dispatchEvent(new Event(t, { bubbles: true }));
      const sl = [...s.querySelectorAll("input[type=range]")];
      const set = async (a) => { for (let i = 0; i < 3; i++) { sl[i].value = String(a[i]); fire(sl[i], "input"); fire(sl[i], "change"); await new Promise((r) => setTimeout(r, 30)); } };
      await set([66, -95, 29]); await set([69, -87, -72]);
      await new Promise((r) => setTimeout(r, 100));
      s.querySelector("button.primary").click();
    });
  },
  "ds-episode-lesen": async () => {
    const sh = await moduleShadow();
    await sh.evaluate((s) => {
      const fire = (n, t) => n.dispatchEvent(new Event(t, { bubbles: true }));
      const r = s.querySelector("input[type=range]"); r.value = "90"; fire(r, "input");
      const pick = (name, v) => { const x = s.querySelector(`input[name=${name}][value="${v}"]`); x.checked = true; fire(x, "change"); };
      pick("fps", 30); pick("lagging_joint", "elbow_flex"); pick("gripper_gap", "contact");
      s.querySelector("form").requestSubmit();
    });
  },
};
async function solve(unit) {
  if (unit.room === "guided-lesson") return solveGuided(unit);
  if (unit.room === "video") {
    await page.waitForSelector(".video-activity", { timeout: 20000 });
    await page.evaluate(() => [...document.querySelectorAll(".video-activity > button")].pop().click());
    return;
  }
  if (unit.room === "custom") { assert(CUSTOM[unit.id], `no solver for custom unit ${unit.id}`); return CUSTOM[unit.id](); }
  throw new Error(`unknown room type ${unit.room}`);
}

// ------------------------------------------------------------------ courses
const me = await api("/auth/users/me");
let lastXp = 0;
const courseSummary = [];
for (const pathId of COURSES) {
  const units = unitsOf(pathId);
  const byTitle = Object.fromEntries(units.map((u) => [u.title.de.trim(), u]));
  await step(`course:${pathId}`, async () => {
    // enter the course the way a learner does: course page -> learn
    await go(`/courses/${pathId}`);
    await page.waitForFunction(() => document.body.innerText.length > 200, { timeout: 20000 });
    await go(`/learn?path=${pathId}&course=${pathId}`);
    const done = [];
    for (let guard = 0; guard < units.length + 3 && done.length < units.length; guard++) {
      await page.waitForSelector(".learning-room h1", { timeout: 30000 });
      const title = (await page.evaluate(() => document.querySelector(".learning-room h1").innerText)).trim();
      const unit = byTitle[title];
      assert(unit, `player shows "${title}", which is not a unit of ${pathId}`);
      assert(!done.includes(unit.id), `player offered ${unit.id} again after completing it`);
      if (!(await page.$(".finished-room"))) await solve(unit);
      await page.waitForSelector(".finished-room", { timeout: 20000 });
      done.push(unit.id);
      if (done.length === 1) await shot(`${pathId}-first-done`);
      if (done.length < units.length) {
        await clickText(".finished-room button", /.+/);
        await page.waitForFunction(() => !document.querySelector(".finished-room"), { timeout: 20000 });
        await sleep(300);
      }
    }
    assert(done.length === units.length, `completed ${done.length}/${units.length}`);
    // every unit completed in the backend
    const open = [];
    for (const u of units) {
      const r = await api(`/skills/rooms?path=${pathId}&course=${pathId}&unit=${u.id}`);
      if (r?.next?.progress?.status !== "completed") open.push(`${u.id}=${r?.next?.progress?.status}`);
    }
    assert(!open.length, `not completed in API: ${open.join(", ")}`);
    // course page counter
    await go(`/courses/${pathId}`);
    await sleep(1200);
    const m = (await text()).match(/(\d+)\s*\/\s*(\d+)\s*(erledigt|done|completed)/i);
    await shot(`${pathId}-course-page`);
    assert(m && m[1] === m[2] && Number(m[2]) === units.length, `course page shows "${m?.[0]}" for ${units.length} units`);
    // XP grows (xp-bridge is async)
    let xp = { total_xp: lastXp };
    for (let i = 0; i < 15 && !(xp.total_xp > lastXp); i++) { await sleep(1000); xp = await api(`/skills/xp/${me.id}`); }
    assert(xp.total_xp > lastXp, `XP did not grow (${lastXp} -> ${xp.total_xp})`);
    const gained = xp.total_xp - lastXp;
    lastXp = xp.total_xp;
    courseSummary.push({ course: pathId, units: units.length, gainedXp: gained, totalXp: lastXp });
    return { units: done.length, counter: m[0], xp: `+${gained} = ${lastXp}` };
  });
}

// ------------------------------------------------------------------ final state
await step("dashboard-shows-xp", async () => {
  const xp = await api(`/skills/xp/${me.id}`);
  await go("/dashboard");
  await sleep(1500);
  const t = await text();
  await shot("dashboard-end", true);
  assert(new RegExp(`\\b${xp.total_xp.toLocaleString("de-DE").replace(".", "\\.?")}\\s*XP`).test(t), `dashboard does not show ${xp.total_xp} XP`);
  return { total_xp: xp.total_xp, level: xp.total_level, rootSkills: (xp.skills || []).length };
});
await step("continue-after-everything-done", async () => {
  await go("/dashboard");
  await page.waitForSelector(".practice-button:not([disabled])", { timeout: 20000 });
  await page.click(".practice-button");
  await sleep(2500);
  const t = await text();
  await shot("continue-when-all-done");
  assert(!/konnte nicht geladen|could not be loaded/i.test(t), "error page after clicking Weiterlernen with everything done");
  const u = new URL(page.url());
  return { landedOn: u.pathname + u.search, says: (t.match(/[^\n]*(geschafft|abgeschlossen|alle|wiederhol|completed|done)[^\n]*/i) || [""])[0].slice(0, 120) };
});
await step("skill-tree-progress", async () => {
  const xp = await api(`/skills/xp/${me.id}`);
  const tree = await (await fetch(`${API}/skills/skilltree`)).json();
  const skills = Object.fromEntries((xp.skills || []).map((s) => [s.skill, s]));
  const withXp = tree.skills.filter((s) => (skills[s.id]?.xp ?? 0) > 0).map((s) => s.id);
  await go("/skill-tree");
  await sleep(2500);
  await shot("skill-tree-end");
  assert(withXp.length === tree.skills.length, `skills without XP: ${tree.skills.filter((s) => !withXp.includes(s.id)).map((s) => s.id).join(", ")}`);
  return { rootSkillsWithXp: `${withXp.length}/${tree.skills.length}` };
});
await step("relogin-keeps-progress", async () => {
  await page.close();
  page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 1440, height: 900 });
  wire(page);
  await login();
  const xp = await api(`/skills/xp/${me.id}`);
  assert(xp.total_xp === lastXp, `XP after relogin ${xp.total_xp} != ${lastXp}`);
  const p = COURSES[0];
  await go(`/courses/${p}`);
  await sleep(1200);
  const m = (await text()).match(/(\d+)\s*\/\s*(\d+)\s*(erledigt|done|completed)/i);
  assert(m && m[1] === m[2], `course ${p} after relogin: ${m?.[0]}`);
  return { xp: xp.total_xp, [p]: m[0] };
});

await browser.close();
const summary = {
  when: new Date().toISOString(), user: USER,
  passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length,
  courses: courseSummary, results, consoleErrors, failedRequests,
};
fs.writeFileSync(path.join(HERE, "course-run.json"), JSON.stringify(summary, null, 2));
console.log(`\n${summary.passed} passed, ${summary.failed} failed; ${consoleErrors.length} console errors, ${failedRequests.length} failed requests (see course-run.json)`);
process.exit(summary.failed ? 1 : 0);

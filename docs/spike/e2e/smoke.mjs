// EmAI Academy smoke test: read-only, no browser, no account, no npm install (Node >= 18).
// Safe to run against production any time, e.g. from the Hermes agent after a deploy.
//
//   node smoke.mjs                                  # https://academy.emai.dev
//   EMAI_WEB=http://localhost:8088 node smoke.mjs   # compose stack
//   EMAI_WEB=http://localhost:3001 EMAI_API=http://127.0.0.1:8191 node smoke.mjs   # dev stack
//
// Exit 0 only if every check passed. Prints one line per check, then a JSON summary.
const WEB = (process.env.EMAI_WEB || "https://academy.emai.dev").replace(/\/$/, "");
const API = (process.env.EMAI_API || `${WEB}/api`).replace(/\/$/, "");
const EXPECT = { skills: Number(process.env.EMAI_EXPECT_SKILLS || 9), courses: Number(process.env.EMAI_EXPECT_COURSES || 21) };

const results = [];
function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ check: name, ok: true, detail: detail ?? "" });
    console.log(`PASS ${name}${detail ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  } catch (e) {
    results.push({ check: name, ok: false, detail: String(e?.message || e) });
    console.log(`FAIL ${name}: ${e?.message || e}`);
  }
}
async function get(url, { json = false, redirect = "follow" } = {}) {
  const r = await fetch(url, { redirect, signal: AbortSignal.timeout(15000), headers: { "User-Agent": "emai-academy-smoke" } });
  const body = await r.text();
  if (!json) return { status: r.status, headers: r.headers, body };
  try { return { status: r.status, headers: r.headers, body: JSON.parse(body) }; }
  catch { throw new Error(`${url}: HTTP ${r.status}, not JSON: ${body.slice(0, 120)}`); }
}

let index = "";
await check("web-index", async () => {
  const r = await get(`${WEB}/`);
  assert(r.status === 200, `HTTP ${r.status}`);
  index = r.body;
  assert(/<title>[^<]*EmAI Academy/i.test(index), "no 'EmAI Academy' <title> in index.html");
  return `${index.length} bytes`;
});
await check("web-assets", async () => {
  const assets = [...index.matchAll(/(?:src|href)="(\/_nuxt\/[^"]+)"/g)].map((m) => m[1]);
  assert(assets.length, "index.html references no /_nuxt/ assets");
  for (const a of assets.slice(0, 5)) {
    const r = await get(WEB + a);
    assert(r.status === 200, `${a}: HTTP ${r.status}`);
  }
  return `${Math.min(assets.length, 5)}/${assets.length} assets checked`;
});
await check("web-spa-fallback", async () => {
  for (const p of ["/dashboard", "/learn?path=physical-ai-grundlagen", "/auth/signup", "/skill-tree"]) {
    const r = await get(WEB + p);
    assert(r.status === 200 && /<div id="__nuxt"|<html/i.test(r.body), `${p}: HTTP ${r.status}`);
  }
});
await check("web-healthz", async () => {
  const r = await get(`${WEB}/healthz`);
  // /healthz is the pod probe; behind Cloudflare it may be blocked or rewritten, so only report it
  return `HTTP ${r.status}`;
});
await check("api-health", async () => {
  const r = await get(`${API}/health`, { json: true });
  assert(r.status === 200, `HTTP ${r.status}`);
  const bad = Object.entries(r.body).filter(([, v]) => v !== true).map(([k]) => k);
  assert(!bad.length, `unhealthy: ${bad.join(", ")} (${JSON.stringify(r.body)})`);
  return r.body;
});
await check("skill-tree", async () => {
  const r = await get(`${API}/skills/skilltree`, { json: true });
  assert(r.status === 200, `HTTP ${r.status}`);
  const n = r.body.skills?.length ?? 0;
  assert(n === EXPECT.skills, `${n} root skills, expected ${EXPECT.skills} (empty = seed Job has not run)`);
  const stray = r.body.skills.filter((s) => /bootstrap|python/i.test(s.name)).map((s) => s.name);
  assert(!stray.length, `upstream skills visible: ${stray.join(", ")}`);
  return `${n} skills, ${r.body.skills.reduce((a, s) => a + s.dependencies.length, 0)} edges`;
});
await check("courses", async () => {
  const r = await get(`${API}/skills/courses`, { json: true });
  assert(r.status === 200, `HTTP ${r.status}`);
  assert(r.body.length === EXPECT.courses, `${r.body.length} courses, expected ${EXPECT.courses}`);
  const paid = r.body.filter((c) => c.price > 0).map((c) => c.id);
  assert(!paid.length, `courses with a price: ${paid.join(", ")}`);
  return `${r.body.length} courses, all free`;
});
await check("learning-rooms", async () => {
  const r = await get(`${API}/skills/rooms/capabilities`, { json: true });
  assert(r.status === 200 && r.body.enabled === true, `HTTP ${r.status} ${JSON.stringify(r.body)}`);
});
await check("challenges-stub", async () => {
  const r = await get(`${API}/challenges/courses/physical-ai-grundlagen/tasks`, { json: true });
  assert(r.status === 200 && Array.isArray(r.body) && r.body.length === 0, `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
});
await check("auth-requires-login", async () => {
  const r = await get(`${API}/auth/users/me`);
  assert(r.status === 401 || r.status === 403, `unauthenticated /auth/users/me returned HTTP ${r.status}`);
  return `HTTP ${r.status}`;
});
if (WEB.startsWith("https://")) {
  await check("http-redirects-to-https", async () => {
    const r = await get(WEB.replace("https://", "http://") + "/", { redirect: "manual" });
    assert([301, 302, 307, 308].includes(r.status) && /^https:/.test(r.headers.get("location") || ""), `HTTP ${r.status} location=${r.headers.get("location")}`);
  });
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ web: WEB, api: API, passed: results.length - failed.length, failed: failed.length, failures: failed }, null, 2));
process.exit(failed.length ? 1 : 0);

// EmAI Academy lesson module: forward kinematics of a planar 3-link arm
// (a simplified side view of the SO-101: shoulder_lift, elbow_flex, wrist_flex).
//
// Contract: Bootstrap Academy learning module API v1
// (frontend/types/learningModule.ts). The module renders only into the element it
// receives, keeps all per-learner data in the instance, reports its work through
// host.change() and requests completion with host.complete({ reached: true }).
// The server compares that answer with completion.answer in learning_rooms.json.

export const apiVersion = 1;

const SVG = "http://www.w3.org/2000/svg";
const ANSWER = Object.freeze({ reached: true });

const DEFAULTS = {
  // Link lengths in mm (upper arm, forearm, wrist + gripper), roughly SO-101.
  links: [116, 135, 95],
  limits: [
    [0, 180],
    [-160, 160],
    [-120, 120],
  ],
  start: [90, -90, 0],
  targets: [
    { id: "a", x: 260, z: 40, r: 18 },
    { id: "b", x: 170, z: -30, r: 18, pitch: -90, pitch_tolerance: 15 },
  ],
};

const COPY = {
  de: {
    title: "Vorwärtskinematik: Greifer ins Ziel",
    intro:
      "Stellen Sie die drei Gelenkwinkel des Arms ein. Aus ihnen und den Gliedlängen ergibt sich die Position des Greifers. Bringen Sie den Greifer nacheinander in jede Zielzone.",
    joints: ["Schulter (shoulder_lift)", "Ellbogen (elbow_flex)", "Handgelenk (wrist_flex)"],
    effector: "Greifer (TCP)",
    pitch: "Neigung",
    target: "Ziel",
    tolerance: "Toleranz",
    pitchNeed: (p, t) => `Greifer-Neigung ${p}° ± ${t}°`,
    distance: "Abstand zum Ziel",
    reset: "Zurücksetzen",
    submit: "Aufgabe abschließen",
    submitted: "Abschluss angefragt. Das Ergebnis bestätigt die Akademie.",
    reachedOne: (id) => `Ziel ${id} erreicht.`,
    allReached: "Alle Ziele erreicht. Sie können die Aufgabe jetzt abschließen.",
    inZoneWrongPitch: "Position stimmt, aber die Neigung des Greifers noch nicht.",
    next: (id) => `Aktuelles Ziel: ${id}`,
    done: "erreicht",
    open: "offen",
    formula: "Formel",
    locked: "Diese Aktivität ist gerade gesperrt.",
    figure: "Seitenansicht des Arms mit Zielzonen",
  },
  en: {
    title: "Forward kinematics: reach the target",
    intro:
      "Set the arm's three joint angles. Together with the link lengths they determine where the gripper ends up. Move the gripper into each target zone in turn.",
    joints: ["Shoulder (shoulder_lift)", "Elbow (elbow_flex)", "Wrist (wrist_flex)"],
    effector: "Gripper (TCP)",
    pitch: "Pitch",
    target: "Target",
    tolerance: "tolerance",
    pitchNeed: (p, t) => `gripper pitch ${p}° ± ${t}°`,
    distance: "Distance to target",
    reset: "Reset",
    submit: "Complete task",
    submitted: "Completion requested. The Academy confirms the result.",
    reachedOne: (id) => `Target ${id} reached.`,
    allReached: "All targets reached. You can complete the task now.",
    inZoneWrongPitch: "Position is right, but the gripper pitch is not yet.",
    next: (id) => `Current target: ${id}`,
    done: "reached",
    open: "open",
    formula: "Formula",
    locked: "This activity is locked right now.",
    figure: "Side view of the arm with target zones",
  },
};

const STYLE = `
:host { all: initial; display: block; container-type: inline-size;
  --bg: var(--emai-bg, #141414); --surface: var(--emai-surface, #1F1F1F);
  --line: var(--emai-border, #333130); --accent: var(--emai-accent, #FF6700);
  --teal: var(--emai-secondary, #2DD4BF); --text: var(--emai-text, #F5F5F4);
  --muted: var(--emai-muted, #A8A29E);
  --heading: var(--emai-font-heading, "Space Grotesk", "Geist", ui-sans-serif, system-ui, sans-serif);
  --body: var(--emai-font-body, "Geist", "Space Grotesk", ui-sans-serif, system-ui, sans-serif);
  --mono: var(--emai-font-mono, "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace);
  color: var(--text); font-family: var(--body); font-size: 15px; line-height: 1.5; }
* { box-sizing: border-box; }
.wrap { background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
h2 { font-family: var(--heading); font-weight: 600; font-size: 20px; margin: 0 0 4px; letter-spacing: -0.01em; }
.kicker { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin: 0 0 6px; }
p { margin: 0; }
.intro { color: var(--muted); max-width: 70ch; margin-bottom: 16px; }
.grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
@container (min-width: 760px) { .grid { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); } }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px; min-width: 0; }
.panel h3 { font-family: var(--heading); font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin: 0 0 10px; }
svg { display: block; width: 100%; height: auto; }
.joint { margin-bottom: 12px; }
.joint label { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
.joint output { font-family: var(--mono); color: var(--text); }
input[type=range] { width: 100%; accent-color: var(--accent); margin: 6px 0 0; height: 24px; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 14px; }
dt { color: var(--muted); }
dd { margin: 0; font-family: var(--mono); text-align: right; }
.formula { font-family: var(--mono); font-size: 12px; color: var(--muted); margin-top: 10px; overflow-wrap: anywhere; }
ul.targets { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 6px; }
ul.targets li { display: flex; gap: 10px; align-items: center; font-size: 14px; }
.badge { font-family: var(--mono); font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); white-space: nowrap; }
li.current .badge { border-color: var(--accent); color: var(--accent); }
li.reached .badge { border-color: var(--teal); color: var(--teal); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
button { font: 600 14px/1 var(--body); border-radius: 10px; padding: 11px 16px; cursor: pointer; border: 1px solid var(--line); background: transparent; color: var(--text); }
button.primary { background: var(--accent); border-color: var(--accent); color: #141414; }
button:disabled { opacity: .45; cursor: not-allowed; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
.status { min-height: 1.5em; margin-top: 10px; font-size: 14px; color: var(--teal); }
.status.warn { color: var(--accent); }
.axis { font: 10px var(--mono); fill: var(--muted); }
`;

const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value));
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const rad = (deg) => (deg * Math.PI) / 180;
const normalize = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

function config(content) {
  const c = content && typeof content === "object" ? content : {};
  const links =
    Array.isArray(c.links) && c.links.length === 3 && c.links.every((l) => finite(l) && l > 0)
      ? c.links.slice()
      : DEFAULTS.links.slice();
  const limits =
    Array.isArray(c.limits) &&
    c.limits.length === 3 &&
    c.limits.every((l) => Array.isArray(l) && l.length === 2 && finite(l[0]) && finite(l[1]) && l[0] < l[1])
      ? c.limits.map((l) => l.slice())
      : DEFAULTS.limits.map((l) => l.slice());
  const start =
    Array.isArray(c.start) && c.start.length === 3 && c.start.every(finite)
      ? c.start.map((v, i) => clamp(Math.round(v), limits[i]))
      : DEFAULTS.start.slice();
  const targets = (
    Array.isArray(c.targets) && c.targets.length
      ? c.targets.filter((t) => t && finite(t.x) && finite(t.z))
      : DEFAULTS.targets
  ).map((t, i) => ({
    id: typeof t.id === "string" && t.id ? t.id.slice(0, 12) : String.fromCharCode(97 + i),
    x: t.x,
    z: t.z,
    r: finite(t.r) && t.r > 0 ? t.r : 18,
    pitch: finite(t.pitch) ? t.pitch : undefined,
    pitchTolerance: finite(t.pitch_tolerance) ? t.pitch_tolerance : 15,
  }));
  return { links, limits, start, targets };
}

/** Forward kinematics: cumulative joint angles, positions of every joint. */
export function forwardKinematics(links, angles) {
  let x = 0;
  let z = 0;
  let phi = 0;
  const points = [{ x, z }];
  for (let i = 0; i < links.length; i++) {
    phi += angles[i];
    x += links[i] * Math.cos(rad(phi));
    z += links[i] * Math.sin(rad(phi));
    points.push({ x, z });
  }
  return { points, x, z, pitch: normalize(phi) };
}

function evaluate(target, fk) {
  const distance = Math.hypot(fk.x - target.x, fk.z - target.z);
  const inZone = distance <= target.r;
  const pitchOk =
    target.pitch === undefined || Math.abs(normalize(fk.pitch - target.pitch)) <= target.pitchTolerance;
  return { distance, inZone, pitchOk, reached: inZone && pitchOk };
}

function el(doc, tag, attrs = {}, parent) {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  parent?.append(node);
  return node;
}
function svgEl(doc, tag, attrs = {}, parent) {
  const node = doc.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
}

export function mount(element, host) {
  const doc = element.ownerDocument;
  const root = element.shadowRoot || (element.attachShadow ? element.attachShadow({ mode: "open" }) : element);
  const listeners = new AbortController();
  const stop = () => listeners.abort();
  host.signal.addEventListener("abort", stop, { once: true });
  const on = (target, type, fn) => target.addEventListener(type, fn, { signal: listeners.signal });

  let context = host.context;
  let cfg = config(context.content);
  let angles = cfg.start.slice();
  let reached = [];
  let submitted = false;
  let message = { text: "", warn: false };
  const trail = [];

  // ---------- static DOM ----------
  el(doc, "style", { text: STYLE }, root);
  const wrap = el(doc, "div", { class: "wrap" }, root);
  const kicker = el(doc, "p", { class: "kicker", text: "Physical AI · Kinematik" }, wrap);
  const title = el(doc, "h2", {}, wrap);
  const intro = el(doc, "p", { class: "intro" }, wrap);
  const grid = el(doc, "div", { class: "grid" }, wrap);

  const stage = el(doc, "div", { class: "panel" }, grid);
  const view = { x0: -150, z0: -110, w: 540, h: 480 };
  const svg = svgEl(doc, "svg", {
    viewBox: `${view.x0} ${-(view.z0 + view.h)} ${view.w} ${view.h}`,
    role: "img",
  }, stage);
  const svgTitle = svgEl(doc, "title", {}, svg);
  const gridLayer = svgEl(doc, "g", {}, svg);
  for (let x = -100; x <= 350; x += 50) {
    svgEl(doc, "line", { x1: x, x2: x, y1: -(view.z0 + view.h), y2: -view.z0, stroke: "#262626", "stroke-width": x === 0 ? 1.5 : 1 }, gridLayer);
    if (x !== 0) svgEl(doc, "text", { x: x + 3, y: -view.z0 - 6, class: "axis" }, gridLayer).textContent = String(x);
  }
  for (let z = -100; z <= 350; z += 50) {
    svgEl(doc, "line", { x1: view.x0, x2: view.x0 + view.w, y1: -z, y2: -z, stroke: "#262626", "stroke-width": z === 0 ? 1.5 : 1 }, gridLayer);
    svgEl(doc, "text", { x: view.x0 + 4, y: -z - 3, class: "axis" }, gridLayer).textContent = String(z);
  }
  svgEl(doc, "text", { x: view.x0 + view.w - 60, y: -view.z0 - 20, class: "axis" }, gridLayer).textContent = "x [mm]";
  svgEl(doc, "text", { x: view.x0 + 34, y: -(view.z0 + view.h) + 12, class: "axis" }, gridLayer).textContent = "z [mm]";
  // Table and base.
  svgEl(doc, "rect", { x: view.x0, y: 60, width: view.w, height: 60, fill: "#1b1b1b" }, svg);
  svgEl(doc, "line", { x1: view.x0, x2: view.x0 + view.w, y1: 60, y2: 60, stroke: "#57534E", "stroke-width": 2 }, svg);
  svgEl(doc, "rect", { x: -28, y: 0, width: 56, height: 60, rx: 6, fill: "#262626", stroke: "#57534E" }, svg);
  const targetLayer = svgEl(doc, "g", {}, svg);
  const trailLine = svgEl(doc, "polyline", { fill: "none", stroke: "#FF6700", "stroke-opacity": 0.28, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
  const linkLines = [0, 1, 2].map(() =>
    svgEl(doc, "line", { stroke: "#E7E5E4", "stroke-width": 14, "stroke-linecap": "round" }, svg)
  );
  const linkCores = [0, 1, 2].map(() =>
    svgEl(doc, "line", { stroke: "#FF6700", "stroke-width": 6, "stroke-linecap": "round" }, svg)
  );
  const jointDots = [0, 1, 2].map(() =>
    svgEl(doc, "circle", { r: 9, fill: "#141414", stroke: "#2DD4BF", "stroke-width": 3 }, svg)
  );
  const fingers = [0, 1].map(() =>
    svgEl(doc, "line", { stroke: "#E7E5E4", "stroke-width": 5, "stroke-linecap": "round" }, svg)
  );
  const tcp = svgEl(doc, "circle", { r: 4, fill: "#FF6700" }, svg);

  const side = el(doc, "div", { class: "grid", style: "grid-template-columns:1fr;gap:16px" }, grid);
  const controls = el(doc, "div", { class: "panel" }, side);
  const controlsTitle = el(doc, "h3", {}, controls);
  const sliders = [0, 1, 2].map((i) => {
    const row = el(doc, "div", { class: "joint" }, controls);
    const label = el(doc, "label", { for: `joint-${i}` }, row);
    const name = el(doc, "span", {}, label);
    const output = el(doc, "output", { for: `joint-${i}` }, label);
    const input = el(doc, "input", { id: `joint-${i}`, type: "range", step: "1" }, row);
    return { name, output, input };
  });
  const readout = el(doc, "dl", {}, controls);
  const rx = [el(doc, "dt", {}, readout), el(doc, "dd", {}, readout)];
  const rz = [el(doc, "dt", {}, readout), el(doc, "dd", {}, readout)];
  const rp = [el(doc, "dt", {}, readout), el(doc, "dd", {}, readout)];
  const rd = [el(doc, "dt", {}, readout), el(doc, "dd", {}, readout)];
  const formula = el(doc, "p", { class: "formula" }, controls);

  const task = el(doc, "div", { class: "panel" }, side);
  const taskTitle = el(doc, "h3", {}, task);
  const targetList = el(doc, "ul", { class: "targets" }, task);
  const actions = el(doc, "div", { class: "actions" }, task);
  const submit = el(doc, "button", { type: "button", class: "primary" }, actions);
  const reset = el(doc, "button", { type: "button" }, actions);
  const status = el(doc, "p", { class: "status", role: "status", "aria-live": "polite" }, task);

  // ---------- behaviour ----------
  const copy = () => (context.locale && context.locale.startsWith("de") ? COPY.de : COPY.en);
  const currentTarget = () => cfg.targets.find((t) => !reached.includes(t.id));
  const allReached = () => cfg.targets.every((t) => reached.includes(t.id));
  const state = () => ({ angles: angles.slice(), reached: reached.slice() });

  function applyState(next) {
    if (next && Array.isArray(next.angles) && next.angles.length === 3 && next.angles.every(finite)) {
      angles = next.angles.map((v, i) => clamp(Math.round(v), cfg.limits[i]));
    }
    if (next && Array.isArray(next.reached)) {
      const ids = new Set(cfg.targets.map((t) => t.id));
      reached = next.reached.filter((id) => typeof id === "string" && ids.has(id));
    }
  }

  function progress(fk) {
    const target = currentTarget();
    if (!target) return false;
    const result = evaluate(target, fk);
    if (result.reached) {
      reached = [...reached, target.id];
      message = { text: allReached() ? copy().allReached : copy().reachedOne(target.id.toUpperCase()), warn: false };
      return true;
    }
    if (result.inZone && !result.pitchOk) message = { text: copy().inZoneWrongPitch, warn: true };
    else if (message.warn) message = { text: "", warn: false };
    return false;
  }

  function render() {
    const t = copy();
    const locked = context.disabled;
    const fk = forwardKinematics(cfg.links, angles);
    title.textContent = typeof context.content?.title === "string" ? context.content.title : t.title;
    intro.textContent = typeof context.content?.intro === "string" ? context.content.intro : t.intro;
    kicker.textContent = context.locale?.startsWith("de") ? "Physical AI · Kinematik" : "Physical AI · Kinematics";
    svgTitle.textContent = t.figure;
    controlsTitle.textContent = context.locale?.startsWith("de") ? "Gelenke" : "Joints";
    taskTitle.textContent = context.locale?.startsWith("de") ? "Aufgabe" : "Task";

    sliders.forEach((s, i) => {
      s.name.textContent = t.joints[i];
      s.input.min = String(cfg.limits[i][0]);
      s.input.max = String(cfg.limits[i][1]);
      if (s.input.value !== String(angles[i])) s.input.value = String(angles[i]);
      s.input.disabled = locked;
      s.output.value = `θ${i + 1} = ${angles[i]}°`;
      s.output.textContent = `θ${i + 1} = ${angles[i]}°`;
    });

    // Arm geometry (screen y = -z).
    fk.points.slice(0, 3).forEach((p, i) => {
      const q = fk.points[i + 1];
      for (const line of [linkLines[i], linkCores[i]]) {
        line.setAttribute("x1", p.x); line.setAttribute("y1", -p.z);
        line.setAttribute("x2", q.x); line.setAttribute("y2", -q.z);
      }
      jointDots[i].setAttribute("cx", p.x); jointDots[i].setAttribute("cy", -p.z);
    });
    const phi = rad(fk.pitch);
    const nx = -Math.sin(phi);
    const nz = Math.cos(phi);
    [-1, 1].forEach((side, i) => {
      const bx = fk.x + side * nx * 9;
      const bz = fk.z + side * nz * 9;
      fingers[i].setAttribute("x1", bx - Math.cos(phi) * 4);
      fingers[i].setAttribute("y1", -(bz - Math.sin(phi) * 4));
      fingers[i].setAttribute("x2", bx + Math.cos(phi) * 16);
      fingers[i].setAttribute("y2", -(bz + Math.sin(phi) * 16));
    });
    tcp.setAttribute("cx", fk.x); tcp.setAttribute("cy", -fk.z);
    trailLine.setAttribute("points", trail.map((p) => `${p.x.toFixed(1)},${(-p.z).toFixed(1)}`).join(" "));

    // Targets.
    targetLayer.replaceChildren();
    const current = currentTarget();
    for (const target of cfg.targets) {
      const done = reached.includes(target.id);
      const active = current === target;
      const g = svgEl(doc, "g", { opacity: done || active ? 1 : 0.45 }, targetLayer);
      svgEl(doc, "circle", {
        cx: target.x, cy: -target.z, r: target.r,
        fill: done ? "rgba(45,212,191,0.22)" : "rgba(45,212,191,0.08)",
        stroke: "#2DD4BF", "stroke-width": 2, "stroke-dasharray": done ? "0" : "5 4",
      }, g);
      if (target.pitch !== undefined) {
        const a = rad(target.pitch);
        svgEl(doc, "line", {
          x1: target.x - Math.cos(a) * (target.r + 14), y1: -(target.z - Math.sin(a) * (target.r + 14)),
          x2: target.x - Math.cos(a) * (target.r + 2), y2: -(target.z - Math.sin(a) * (target.r + 2)),
          stroke: "#2DD4BF", "stroke-width": 2,
        }, g);
      }
      svgEl(doc, "text", { x: target.x + target.r + 4, y: -target.z - target.r + 4, class: "axis", style: "fill:#2DD4BF;font-size:12px" }, g).textContent =
        target.id.toUpperCase() + (done ? " ✓" : "");
    }

    // Readouts.
    const unit = " mm";
    rx[0].textContent = "x"; rx[1].textContent = fk.x.toFixed(1) + unit;
    rz[0].textContent = "z"; rz[1].textContent = fk.z.toFixed(1) + unit;
    rp[0].textContent = t.pitch + " (θ1+θ2+θ3)"; rp[1].textContent = fk.pitch.toFixed(0) + "°";
    rd[0].textContent = t.distance;
    rd[1].textContent = current ? evaluate(current, fk).distance.toFixed(1) + unit : "–";
    const [l1, l2, l3] = cfg.links;
    formula.textContent =
      `${t.formula}: x = ${l1}·cos θ1 + ${l2}·cos(θ1+θ2) + ${l3}·cos(θ1+θ2+θ3);  ` +
      `z = ${l1}·sin θ1 + ${l2}·sin(θ1+θ2) + ${l3}·sin(θ1+θ2+θ3)`;

    // Task list.
    targetList.replaceChildren();
    for (const target of cfg.targets) {
      const done = reached.includes(target.id);
      const li = el(doc, "li", { class: done ? "reached" : current === target ? "current" : "" }, targetList);
      el(doc, "span", { class: "badge", text: done ? t.done : t.open }, li);
      let text = `${t.target} ${target.id.toUpperCase()}: x = ${target.x}, z = ${target.z} mm (${t.tolerance} ${target.r} mm)`;
      if (target.pitch !== undefined) text += `, ${t.pitchNeed(target.pitch, target.pitchTolerance)}`;
      el(doc, "span", { text }, li);
    }
    submit.textContent = t.submit;
    reset.textContent = t.reset;
    submit.disabled = locked || !allReached();
    reset.disabled = locked;
    status.className = "status" + (message.warn ? " warn" : "");
    status.textContent = locked ? t.locked : submitted ? t.submitted : message.text;
  }

  sliders.forEach((s, i) => {
    on(s.input, "input", () => {
      if (context.disabled) return;
      angles[i] = clamp(Number(s.input.value), cfg.limits[i]);
      const fk = forwardKinematics(cfg.links, angles);
      trail.push({ x: fk.x, z: fk.z });
      if (trail.length > 60) trail.shift();
      submitted = false;
      const advanced = progress(fk);
      render();
      if (advanced) host.change(state());
    });
    on(s.input, "change", () => {
      if (!context.disabled) host.change(state());
    });
  });
  on(reset, "click", () => {
    if (context.disabled) return;
    angles = cfg.start.slice();
    trail.length = 0;
    message = { text: "", warn: false };
    render();
    host.change(state());
  });
  on(submit, "click", () => {
    if (context.disabled || !allReached()) return;
    submitted = true;
    render();
    host.change(state());
    host.complete({ ...ANSWER });
  });

  applyState(context.state);
  render();

  return {
    update(next) {
      const contentChanged = JSON.stringify(next.content) !== JSON.stringify(context.content);
      context = next;
      if (contentChanged) cfg = config(context.content);
      applyState(context.state);
      render();
    },
    dispose() {
      listeners.abort();
      host.signal.removeEventListener("abort", stop);
      root.replaceChildren();
    },
  };
}

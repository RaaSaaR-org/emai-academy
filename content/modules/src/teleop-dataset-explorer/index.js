// EmAI Academy lesson module: explore a (synthetic) SO-101 teleoperation episode
// in LeRobot dataset v3 layout. The learner scrubs the timeline, compares the
// leader-arm command ("action") with the follower-arm measurement
// ("observation.state") for six joints, and answers three questions.
//
// Contract: Bootstrap Academy learning module API v1
// (frontend/types/learningModule.ts). The episode ships inside the package
// (episode.json, resolved relative to import.meta.url). Completion is requested
// with host.complete({ fps, lagging_joint, gripper_gap }); the server compares it
// with completion.answer in learning_rooms.json.

export const apiVersion = 1;

const SVG = "http://www.w3.org/2000/svg";
const DATA_URL = new URL("./episode.json", import.meta.url);
const JOINTS = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"];
const GAP_OPTIONS = ["contact", "calibration", "dropped_frames", "latency"];
const GAP_CORRECT = "contact";
const FPS_OPTIONS = [10, 15, 30, 50, 60];

const COPY = {
  de: {
    kicker: "Robot Learning · Datensätze",
    title: "Teleoperations-Episode untersuchen",
    intro:
      "Diese Episode wurde mit einem SO-101-Leader-Arm aufgenommen (synthetische Beispieldaten). \"action\" ist das Kommando des Leader-Arms, \"observation.state\" die gemessene Gelenkstellung des Follower-Arms. Bewegen Sie sich durch die Zeitachse und beantworten Sie die Fragen.",
    loading: "Episode wird geladen …",
    loadError: "Die Episode konnte nicht geladen werden.",
    meta: "Metadaten (meta/info.json)",
    task: "Aufgabe der Episode",
    frames: "Frames",
    features: "Features",
    pose: "Armstellung (Seitenansicht)",
    poseLegend: "Orange gestrichelt: action · Türkis: observation.state",
    play: "Abspielen",
    pause: "Pause",
    frame: "Frame",
    phase: "Phase",
    phases: {
      approach: "Annähern",
      descend: "Absenken",
      grasp: "Greifen",
      lift: "Anheben",
      transport: "Transport",
      release: "Loslassen",
      retract: "Zurückziehen",
    },
    charts: "Gelenkverläufe",
    legendAction: "action (Leader)",
    legendObs: "observation.state (Follower)",
    table: "Werte im aktuellen Frame",
    joint: "Gelenk",
    delta: "Δ",
    questions: "Fragen",
    q1: "Mit welcher Bildrate (fps) wurde die Episode aufgezeichnet?",
    q1Hint: "Vergleichen Sie die Zeitstempel zweier aufeinanderfolgender Frames.",
    q2: "Welches Gelenk folgt dem Kommando am deutlichsten verzögert?",
    q2Hint: "Suchen Sie das Gelenk, bei dem die türkise Kurve der orangen am weitesten hinterherläuft.",
    q3: "Während des Transports ist der Greifer auf 0 kommandiert, misst aber etwa 18. Warum?",
    q3Hint: "Achten Sie darauf, in welchen Phasen die Abweichung auftritt und wann sie verschwindet.",
    gap: {
      contact: "Der Würfel liegt zwischen den Fingern und blockiert das Schließen.",
      calibration: "Der Greifer ist falsch kalibriert.",
      dropped_frames: "Es fehlen Frames in der Aufnahme.",
      latency: "Die Funkverbindung zum Leader-Arm ist zu langsam.",
    },
    check: "Antworten prüfen",
    correct: "Richtig.",
    wrong: "Noch nicht.",
    missing: "Bitte beantworten Sie alle Fragen.",
    allCorrect: "Alles richtig. Abschluss angefragt; das Ergebnis bestätigt die Akademie.",
    locked: "Diese Aktivität ist gerade gesperrt.",
    synthetic: "synthetisch",
  },
  en: {
    kicker: "Robot learning · Datasets",
    title: "Explore a teleoperation episode",
    intro:
      "This episode was recorded with an SO-101 leader arm (synthetic sample data). \"action\" is the leader arm's command, \"observation.state\" the measured joint position of the follower arm. Scrub through the timeline and answer the questions.",
    loading: "Loading episode …",
    loadError: "The episode could not be loaded.",
    meta: "Metadata (meta/info.json)",
    task: "Episode task",
    frames: "Frames",
    features: "Features",
    pose: "Arm pose (side view)",
    poseLegend: "Dashed orange: action · Teal: observation.state",
    play: "Play",
    pause: "Pause",
    frame: "Frame",
    phase: "Phase",
    phases: {
      approach: "Approach",
      descend: "Descend",
      grasp: "Grasp",
      lift: "Lift",
      transport: "Transport",
      release: "Release",
      retract: "Retract",
    },
    charts: "Joint trajectories",
    legendAction: "action (leader)",
    legendObs: "observation.state (follower)",
    table: "Values at the current frame",
    joint: "Joint",
    delta: "Δ",
    questions: "Questions",
    q1: "At which frame rate (fps) was the episode recorded?",
    q1Hint: "Compare the timestamps of two consecutive frames.",
    q2: "Which joint follows its command with the clearest delay?",
    q2Hint: "Look for the joint where the teal curve trails the orange one the most.",
    q3: "During transport the gripper is commanded to 0 but measures about 18. Why?",
    q3Hint: "Notice in which phases the gap appears and when it disappears.",
    gap: {
      contact: "The cube sits between the fingers and blocks the gripper from closing.",
      calibration: "The gripper is miscalibrated.",
      dropped_frames: "Frames are missing from the recording.",
      latency: "The radio link to the leader arm is too slow.",
    },
    check: "Check answers",
    correct: "Correct.",
    wrong: "Not yet.",
    missing: "Please answer all questions.",
    allCorrect: "All correct. Completion requested; the Academy confirms the result.",
    locked: "This activity is locked right now.",
    synthetic: "synthetic",
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
.wrap { background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 18px; display: grid; gap: 16px; }
h2 { font-family: var(--heading); font-weight: 600; font-size: 20px; margin: 0 0 4px; letter-spacing: -0.01em; }
.kicker { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin: 0 0 6px; }
p { margin: 0; }
.intro { color: var(--muted); max-width: 75ch; }
.row { display: grid; gap: 16px; grid-template-columns: 1fr; }
@container (min-width: 760px) { .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .charts { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px; min-width: 0; }
h3 { font-family: var(--heading); font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin: 0 0 10px; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 13px; }
dt { color: var(--muted); }
dd { margin: 0; font-family: var(--mono); overflow-wrap: anywhere; }
.pill { display: inline-block; font-family: var(--mono); font-size: 10px; border: 1px solid var(--line); border-radius: 999px; padding: 1px 7px; color: var(--muted); margin-left: 6px; vertical-align: middle; }
svg { display: block; width: 100%; height: auto; }
.small { font-size: 12px; color: var(--muted); }
.timeline { display: grid; gap: 8px; }
.transport { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.readout { font-family: var(--mono); font-size: 13px; }
input[type=range] { width: 100%; accent-color: var(--accent); margin: 0; height: 24px; }
.bands { display: flex; height: 22px; border-radius: 6px; overflow: hidden; gap: 2px; }
.bands span { display: block; line-height: 22px; text-align: center; text-overflow: ellipsis; padding: 0 2px; font: 10px var(--mono); color: var(--muted); background: #262626; white-space: nowrap; overflow: hidden; min-width: 0; }
.bands span.active { background: #3a2415; color: var(--accent); }
.legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: var(--muted); margin-bottom: 8px; }
.legend i { display: inline-block; width: 22px; height: 0; vertical-align: middle; margin-right: 6px; }
.legend .a { border-top: 2px dashed var(--accent); }
.legend .o { border-top: 2px solid var(--teal); }
.charts { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 520px) { .charts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.chart { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 8px 8px 4px; cursor: crosshair; touch-action: none; }
.chart .name { font-family: var(--mono); font-size: 12px; color: var(--text); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: right; padding: 4px 6px; border-bottom: 1px solid var(--line); font-family: var(--mono); }
th:first-child, td:first-child { text-align: left; }
th { color: var(--muted); font-weight: 500; font-family: var(--body); }
fieldset { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px 12px; margin: 0 0 10px; }
legend { padding: 0 4px; font-weight: 600; }
.options { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 6px; }
.options.stack { flex-direction: column; }
.options label { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; cursor: pointer; }
input[type=radio] { accent-color: var(--accent); margin-top: 4px; }
.feedback { font-size: 13px; margin-top: 6px; min-height: 1.2em; }
.feedback.ok { color: var(--teal); }
.feedback.no { color: var(--accent); }
button { font: 600 14px/1 var(--body); border-radius: 10px; padding: 10px 16px; cursor: pointer; border: 1px solid var(--line); background: transparent; color: var(--text); }
button.primary { background: var(--accent); border-color: var(--accent); color: #141414; }
button:disabled { opacity: .45; cursor: not-allowed; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
.status { min-height: 1.5em; font-size: 14px; color: var(--teal); margin-top: 8px; }
.status.warn { color: var(--accent); }
.axis { font: 9px var(--mono); fill: var(--muted); }
`;

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

/** Frame rate derived from timestamps (median step), not from the metadata. */
export function measuredFps(frames) {
  const steps = [];
  for (let i = 1; i < frames.length; i++) steps.push(frames[i].timestamp - frames[i - 1].timestamp);
  steps.sort((a, b) => a - b);
  return Math.round(1 / steps[Math.floor(steps.length / 2)]);
}

/** Delay (frames) that best aligns observation with action for one joint. */
export function jointLag(frames, j, maxLag = 20) {
  let best = Infinity;
  let bestLag = 0;
  for (let k = 0; k <= maxLag; k++) {
    let sum = 0;
    for (let i = k; i < frames.length; i++) {
      sum += Math.abs(frames[i]["observation.state"][j] - frames[i - k].action[j]);
    }
    const mean = sum / (frames.length - k);
    if (mean < best) {
      best = mean;
      bestLag = k;
    }
  }
  return bestLag;
}

function validEpisode(data) {
  return (
    data &&
    Array.isArray(data.frames) &&
    data.frames.length > 10 &&
    data.frames.every(
      (f) =>
        typeof f.timestamp === "number" &&
        Array.isArray(f.action) &&
        f.action.length === 6 &&
        Array.isArray(f["observation.state"]) &&
        f["observation.state"].length === 6
    )
  );
}

export async function mount(element, host) {
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  const root = element.shadowRoot || (element.attachShadow ? element.attachShadow({ mode: "open" }) : element);
  const listeners = new AbortController();
  const stop = () => listeners.abort();
  host.signal.addEventListener("abort", stop, { once: true });
  const on = (target, type, fn, options = {}) =>
    target.addEventListener(type, fn, { ...options, signal: listeners.signal });

  let context = host.context;
  const de = () => !!context.locale && context.locale.startsWith("de");
  const copy = () => (de() ? COPY.de : COPY.en);

  el(doc, "style", { text: STYLE }, root);
  const wrap = el(doc, "div", { class: "wrap" }, root);
  const loading = el(doc, "p", { class: "small", role: "status", text: copy().loading }, wrap);

  let data;
  try {
    const response = await fetch(DATA_URL, { signal: host.signal, credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    if (!validEpisode(data)) throw new Error("Unexpected episode format");
  } catch (error) {
    if (host.signal.aborted) throw error;
    loading.textContent = copy().loadError;
    loading.setAttribute("role", "alert");
    throw error; // the host shows its own retry UI
  }
  loading.remove();

  const frames = data.frames;
  const N = frames.length;
  const fps = measuredFps(frames);
  const lags = JOINTS.map((_, j) => jointLag(frames, j));
  const laggingJoint = JOINTS[lags.indexOf(Math.max(...lags))];
  const phases = Array.isArray(data.episode?.phases) ? data.episode.phases : [];
  const phaseAt = (t) => phases.find((p) => t >= p.from && t < p.to)?.id ?? phases[phases.length - 1]?.id ?? "";
  const ranges = JOINTS.map((_, j) => {
    let min = Infinity;
    let max = -Infinity;
    for (const f of frames) {
      min = Math.min(min, f.action[j], f["observation.state"][j]);
      max = Math.max(max, f.action[j], f["observation.state"][j]);
    }
    const pad = Math.max(2, (max - min) * 0.08);
    return [min - pad, max + pad];
  });

  // ---------- per-instance state ----------
  let frame = 0;
  let answers = { fps: null, lagging_joint: null, gripper_gap: null };
  let checked = false;
  let playing = false;
  let raf = 0;
  let lastTime = 0;
  let carry = 0;

  function applyState(next, initial = false) {
    if (!next || typeof next !== "object") return;
    // The playback position is a local view setting; only restore it on mount.
    if (initial && Number.isInteger(next.frame) && next.frame >= 0 && next.frame < N) frame = next.frame;
    const a = next.answers;
    if (a && typeof a === "object") {
      answers = {
        fps: FPS_OPTIONS.includes(a.fps) ? a.fps : null,
        lagging_joint: JOINTS.includes(a.lagging_joint) ? a.lagging_joint : null,
        gripper_gap: GAP_OPTIONS.includes(a.gripper_gap) ? a.gripper_gap : null,
      };
    }
    checked = next.checked === true;
  }
  const state = () => ({ frame, answers: { ...answers }, checked });

  // ---------- static DOM ----------
  const header = el(doc, "div", {}, wrap);
  const kicker = el(doc, "p", { class: "kicker" }, header);
  const title = el(doc, "h2", {}, header);
  const intro = el(doc, "p", { class: "intro" }, header);

  const top = el(doc, "div", { class: "row" }, wrap);
  const metaPanel = el(doc, "div", { class: "panel" }, top);
  const metaTitle = el(doc, "h3", {}, metaPanel);
  const metaList = el(doc, "dl", {}, metaPanel);

  const posePanel = el(doc, "div", { class: "panel" }, top);
  const poseTitle = el(doc, "h3", {}, posePanel);
  const poseSvg = svgEl(doc, "svg", { viewBox: "-60 -300 420 330", role: "img" }, posePanel);
  const poseDesc = svgEl(doc, "title", {}, poseSvg);
  svgEl(doc, "line", { x1: -60, x2: 360, y1: 20, y2: 20, stroke: "#57534E", "stroke-width": 2 }, poseSvg);
  svgEl(doc, "rect", { x: -22, y: -20, width: 44, height: 40, rx: 5, fill: "#262626", stroke: "#57534E" }, poseSvg);
  const ghost = svgEl(doc, "polyline", { fill: "none", stroke: "#FF6700", "stroke-width": 4, "stroke-dasharray": "8 6", "stroke-linecap": "round", "stroke-linejoin": "round" }, poseSvg);
  const arm = svgEl(doc, "polyline", { fill: "none", stroke: "#2DD4BF", "stroke-width": 10, "stroke-linecap": "round", "stroke-linejoin": "round" }, poseSvg);
  const gripGauge = svgEl(doc, "g", {}, poseSvg);
  svgEl(doc, "text", { x: -50, y: -284, class: "axis" }, gripGauge).textContent = "gripper";
  svgEl(doc, "rect", { x: -50, y: -276, width: 100, height: 10, rx: 3, fill: "#262626" }, gripGauge);
  const gripObs = svgEl(doc, "rect", { x: -50, y: -276, width: 0, height: 10, rx: 3, fill: "#2DD4BF" }, gripGauge);
  const gripAct = svgEl(doc, "line", { y1: -280, y2: -262, stroke: "#FF6700", "stroke-width": 2 }, gripGauge);
  const panText = svgEl(doc, "text", { x: -50, y: -248, class: "axis" }, gripGauge);
  const poseLegend = el(doc, "p", { class: "small" }, posePanel);

  const timeline = el(doc, "div", { class: "panel timeline" }, wrap);
  const transport = el(doc, "div", { class: "transport" }, timeline);
  const playButton = el(doc, "button", { type: "button" }, transport);
  const frameReadout = el(doc, "span", { class: "readout", "aria-live": "off" }, transport);
  const scrubber = el(doc, "input", { type: "range", min: "0", max: String(N - 1), step: "1" }, timeline);
  const bands = el(doc, "div", { class: "bands", "aria-hidden": "true" }, timeline);
  const bandEls = phases.map((p) => {
    const span = el(doc, "span", {}, bands);
    span.style.flex = String(p.to - p.from);
    return span;
  });

  const chartsPanel = el(doc, "div", { class: "panel" }, wrap);
  const chartsTitle = el(doc, "h3", {}, chartsPanel);
  const legend = el(doc, "div", { class: "legend" }, chartsPanel);
  const legendA = el(doc, "span", {}, legend);
  const legendO = el(doc, "span", {}, legend);
  const chartsGrid = el(doc, "div", { class: "charts" }, chartsPanel);
  const W = 300;
  const H = 110;
  const PAD = { l: 30, r: 6, t: 6, b: 14 };
  const xScale = (i) => PAD.l + (i / (N - 1)) * (W - PAD.l - PAD.r);
  const charts = JOINTS.map((joint, j) => {
    const box = el(doc, "div", { class: "chart" }, chartsGrid);
    el(doc, "div", { class: "name", text: joint }, box);
    const svg = svgEl(doc, "svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": joint }, box);
    const [lo, hi] = ranges[j];
    const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    for (const v of [lo, (lo + hi) / 2, hi]) {
      svgEl(doc, "line", { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v), stroke: "#262626" }, svg);
      svgEl(doc, "text", { x: PAD.l - 4, y: y(v) + 3, class: "axis", "text-anchor": "end" }, svg).textContent = v.toFixed(0);
    }
    for (const p of phases) {
      const i = Math.round(p.from * fps);
      if (i > 0) svgEl(doc, "line", { x1: xScale(i), x2: xScale(i), y1: PAD.t, y2: H - PAD.b, stroke: "#2a2a2a", "stroke-dasharray": "2 3" }, svg);
    }
    svgEl(doc, "text", { x: PAD.l, y: H - 2, class: "axis" }, svg).textContent = "0 s";
    svgEl(doc, "text", { x: W - PAD.r, y: H - 2, class: "axis", "text-anchor": "end" }, svg).textContent =
      `${frames[N - 1].timestamp.toFixed(1)} s`;
    const pts = (key) => frames.map((f, i) => `${xScale(i).toFixed(1)},${y(f[key][j]).toFixed(1)}`).join(" ");
    svgEl(doc, "polyline", { points: pts("observation.state"), fill: "none", stroke: "#2DD4BF", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
    svgEl(doc, "polyline", { points: pts("action"), fill: "none", stroke: "#FF6700", "stroke-width": 1.5, "stroke-dasharray": "4 3", "stroke-linejoin": "round" }, svg);
    const cursor = svgEl(doc, "line", { y1: PAD.t, y2: H - PAD.b, stroke: "#F5F5F4", "stroke-opacity": 0.6 }, svg);
    const dotA = svgEl(doc, "circle", { r: 3.5, fill: "#FF6700", stroke: "#141414", "stroke-width": 2 }, svg);
    const dotO = svgEl(doc, "circle", { r: 3.5, fill: "#2DD4BF", stroke: "#141414", "stroke-width": 2 }, svg);
    // Pointer on a chart scrubs the timeline (same as the slider).
    const scrub = (event) => {
      const rect = svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * W;
      setFrame(Math.round(((x - PAD.l) / (W - PAD.l - PAD.r)) * (N - 1)));
    };
    on(box, "pointerdown", (event) => {
      pause();
      box.setPointerCapture?.(event.pointerId);
      scrub(event);
    });
    on(box, "pointermove", (event) => {
      if (event.buttons & 1) scrub(event);
    });
    return { y, cursor, dotA, dotO };
  });

  const bottom = el(doc, "div", { class: "row" }, wrap);
  const tablePanel = el(doc, "div", { class: "panel" }, bottom);
  const tableTitle = el(doc, "h3", {}, tablePanel);
  const table = el(doc, "table", {}, tablePanel);
  const thead = el(doc, "thead", {}, table);
  const headRow = el(doc, "tr", {}, thead);
  const headCells = [0, 1, 2, 3].map(() => el(doc, "th", { scope: "col" }, headRow));
  const tbody = el(doc, "tbody", {}, table);
  const rows = JOINTS.map((joint) => {
    const tr = el(doc, "tr", {}, tbody);
    el(doc, "td", { text: joint }, tr);
    return [el(doc, "td", {}, tr), el(doc, "td", {}, tr), el(doc, "td", {}, tr)];
  });

  const quiz = el(doc, "form", { class: "panel", novalidate: "" }, bottom);
  const quizTitle = el(doc, "h3", {}, quiz);
  function question(name, values, stack) {
    const fieldset = el(doc, "fieldset", {}, quiz);
    const legendEl = el(doc, "legend", {}, fieldset);
    const options = el(doc, "div", { class: "options" + (stack ? " stack" : "") }, fieldset);
    const inputs = values.map((value) => {
      const label = el(doc, "label", {}, options);
      const input = el(doc, "input", { type: "radio", name, value: String(value) }, label);
      const text = el(doc, "span", {}, label);
      return { input, text, value };
    });
    const feedback = el(doc, "p", { class: "feedback", "aria-live": "polite" }, fieldset);
    return { legend: legendEl, inputs, feedback };
  }
  const q1 = question("fps", FPS_OPTIONS, false);
  const q2 = question("lagging_joint", JOINTS, false);
  const q3 = question("gripper_gap", GAP_OPTIONS, true);
  const checkButton = el(doc, "button", { type: "submit", class: "primary" }, quiz);
  const status = el(doc, "p", { class: "status", role: "status", "aria-live": "polite" }, quiz);

  // ---------- behaviour ----------
  function setFrame(next) {
    frame = Math.max(0, Math.min(N - 1, next | 0));
    renderFrame();
  }

  function pose(values) {
    // shoulder_lift measured from horizontal, elbow_flex/wrist_flex relative (degrees).
    const links = [116, 135, 95];
    let x = 0;
    let z = 0;
    let phi = 0;
    const pts = [[0, 0]];
    [values[1], values[2], values[3]].forEach((angle, i) => {
      phi += angle;
      x += links[i] * Math.cos((phi * Math.PI) / 180);
      z += links[i] * Math.sin((phi * Math.PI) / 180);
      pts.push([x, z]);
    });
    return pts.map(([px, pz]) => `${px.toFixed(1)},${(-pz).toFixed(1)}`).join(" ");
  }

  function renderFrame() {
    const t = copy();
    const f = frames[frame];
    const obs = f["observation.state"];
    if (scrubber.value !== String(frame)) scrubber.value = String(frame);
    const phase = phaseAt(f.timestamp);
    frameReadout.textContent = `${t.frame} ${String(frame).padStart(3, "0")} / ${N - 1} · t = ${f.timestamp.toFixed(4)} s · ${t.phase}: ${t.phases[phase] ?? phase}`;
    scrubber.setAttribute("aria-valuetext", frameReadout.textContent);
    bandEls.forEach((span, i) => span.classList.toggle("active", phases[i].id === phase));
    charts.forEach((c, j) => {
      const x = xScale(frame);
      c.cursor.setAttribute("x1", x);
      c.cursor.setAttribute("x2", x);
      c.dotA.setAttribute("cx", x);
      c.dotA.setAttribute("cy", c.y(f.action[j]));
      c.dotO.setAttribute("cx", x);
      c.dotO.setAttribute("cy", c.y(obs[j]));
      rows[j][0].textContent = f.action[j].toFixed(2);
      rows[j][1].textContent = obs[j].toFixed(2);
      rows[j][2].textContent = (obs[j] - f.action[j]).toFixed(2);
    });
    ghost.setAttribute("points", pose(f.action));
    arm.setAttribute("points", pose(obs));
    gripObs.setAttribute("width", Math.max(0, Math.min(100, obs[5])).toFixed(1));
    const ax = -50 + Math.max(0, Math.min(100, f.action[5]));
    gripAct.setAttribute("x1", ax);
    gripAct.setAttribute("x2", ax);
    panText.textContent = `shoulder_pan ${obs[0].toFixed(1)}° · wrist_roll ${obs[4].toFixed(1)}°`;
  }

  function correctness() {
    return {
      fps: answers.fps === fps,
      lagging_joint: answers.lagging_joint === laggingJoint,
      gripper_gap: answers.gripper_gap === GAP_CORRECT,
    };
  }

  function renderStatic() {
    const t = copy();
    const locked = context.disabled;
    kicker.textContent = t.kicker;
    title.textContent = typeof context.content?.title === "string" ? context.content.title : t.title;
    intro.textContent = typeof context.content?.intro === "string" ? context.content.intro : t.intro;
    metaTitle.textContent = t.meta;
    metaList.replaceChildren();
    const info = data.info || {};
    const features = Object.keys(info.features || {});
    const pairs = [
      ["codebase_version", info.codebase_version],
      ["robot_type", info.robot_type],
      [t.frames, `${info.total_frames ?? N} (episode 0)`],
      [t.task, (data.episode?.tasks || []).join("; ")],
      [t.features, features.join(", ")],
      ["action.names", (info.features?.action?.names || []).join(", ")],
      ["data_path", info.data_path],
    ];
    for (const [k, v] of pairs) {
      el(doc, "dt", { text: k }, metaList);
      const dd = el(doc, "dd", { text: String(v ?? "–") }, metaList);
      if (k === "robot_type" && data.episode?.synthetic) el(doc, "span", { class: "pill", text: t.synthetic }, dd);
    }
    poseTitle.textContent = t.pose;
    poseDesc.textContent = t.pose;
    poseLegend.textContent = t.poseLegend;
    playButton.textContent = playing ? t.pause : t.play;
    playButton.setAttribute("aria-pressed", String(playing));
    scrubber.setAttribute("aria-label", t.frame);
    bandEls.forEach((span, i) => (span.textContent = t.phases[phases[i].id] ?? phases[i].id));
    chartsTitle.textContent = t.charts;
    legendA.replaceChildren(el(doc, "i", { class: "a" }), doc.createTextNode(t.legendAction));
    legendO.replaceChildren(el(doc, "i", { class: "o" }), doc.createTextNode(t.legendObs));
    tableTitle.textContent = t.table;
    [t.joint, "action", "observation", t.delta].forEach((text, i) => (headCells[i].textContent = text));
    quizTitle.textContent = t.questions;

    const result = correctness();
    const hints = { fps: t.q1Hint, lagging_joint: t.q2Hint, gripper_gap: t.q3Hint };
    [
      [q1, t.q1, "fps", (v) => `${v} fps`],
      [q2, t.q2, "lagging_joint", (v) => v],
      [q3, t.q3, "gripper_gap", (v) => t.gap[v]],
    ].forEach(([q, label, key, text]) => {
      q.legend.textContent = label;
      q.inputs.forEach((o) => {
        o.text.textContent = text(o.value);
        o.input.checked = answers[key] === o.value;
        o.input.disabled = locked;
      });
      if (checked && answers[key] !== null) {
        q.feedback.className = "feedback " + (result[key] ? "ok" : "no");
        q.feedback.textContent = result[key] ? t.correct : `${t.wrong} ${hints[key]}`;
      } else {
        q.feedback.className = "feedback";
        q.feedback.textContent = "";
      }
    });
    checkButton.textContent = t.check;
    checkButton.disabled = locked;
    if (locked) {
      status.className = "status";
      status.textContent = t.locked;
    }
    renderFrame();
  }

  function tick(now) {
    if (!playing) return;
    if (lastTime) carry += ((now - lastTime) / 1000) * fps;
    lastTime = now;
    const steps = Math.floor(carry);
    if (steps > 0) {
      carry -= steps;
      if (frame + steps >= N - 1) {
        setFrame(N - 1);
        pause();
        return;
      }
      setFrame(frame + steps);
    }
    raf = win.requestAnimationFrame(tick);
  }
  function play() {
    if (playing) return;
    if (frame >= N - 1) setFrame(0);
    playing = true;
    lastTime = 0;
    carry = 0;
    raf = win.requestAnimationFrame(tick);
    renderStatic();
  }
  function pause() {
    if (!playing) return;
    playing = false;
    win.cancelAnimationFrame(raf);
    renderStatic();
  }

  on(playButton, "click", () => (playing ? pause() : play()));
  on(scrubber, "input", () => {
    pause();
    setFrame(Number(scrubber.value));
  });
  on(quiz, "change", (event) => {
    const input = event.target;
    if (context.disabled || !input || input.type !== "radio") return;
    const key = input.name;
    const value = key === "fps" ? Number(input.value) : input.value;
    answers = { ...answers, [key]: value };
    checked = false;
    status.textContent = "";
    renderStatic();
    host.change(state());
  });
  on(quiz, "submit", (event) => {
    event.preventDefault();
    if (context.disabled) return;
    const t = copy();
    checked = true;
    if (Object.values(answers).some((v) => v === null)) {
      renderStatic();
      status.className = "status warn";
      status.textContent = t.missing;
      host.change(state());
      return;
    }
    const result = correctness();
    renderStatic();
    host.change(state());
    if (Object.values(result).every(Boolean)) {
      status.className = "status";
      status.textContent = t.allCorrect;
      host.complete({ fps: answers.fps, lagging_joint: answers.lagging_joint, gripper_gap: answers.gripper_gap });
    } else {
      status.className = "status warn";
      status.textContent = "";
    }
  });

  applyState(context.state, true);
  renderStatic();

  return {
    update(next) {
      context = next;
      applyState(context.state);
      renderStatic();
    },
    cancelPreparation() {
      pause();
    },
    dispose() {
      playing = false;
      win.cancelAnimationFrame(raf);
      listeners.abort();
      host.signal.removeEventListener("abort", stop);
      root.replaceChildren();
    },
  };
}

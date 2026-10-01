// Generates the synthetic SO-101 teleoperation episode bundled with the
// "teleop-dataset-explorer" module. Deterministic (seeded PRNG): re-running it
// yields byte-identical output, so the packaged artifact hash stays stable.
//
//   node tools/generate-episode.mjs > src/teleop-dataset-explorer/episode.json
//
// Shape follows LeRobot dataset v3 conventions (meta/info.json-like header,
// per-frame rows with timestamp, frame_index, action, observation.state), but
// flattened into one small JSON file for the browser.

const FPS = 30;
const SECONDS = 6;
const N = FPS * SECONDS;
const JOINTS = [
  "shoulder_pan",
  "shoulder_lift",
  "elbow_flex",
  "wrist_flex",
  "wrist_roll",
  "gripper",
];
// Per-joint transport delay (frames) + first-order smoothing of the follower.
// elbow_flex carries the most load and lags clearly behind the leader arm.
const DELAY = { shoulder_pan: 2, shoulder_lift: 2, elbow_flex: 7, wrist_flex: 1, wrist_roll: 1, gripper: 2 };
const ALPHA = { shoulder_pan: 0.55, shoulder_lift: 0.5, elbow_flex: 0.35, wrist_flex: 0.6, wrist_roll: 0.6, gripper: 0.5 };
const CUBE_WIDTH = 18; // gripper cannot close further while holding the cube

// Keyframes of the leader arm (degrees; gripper 0 = closed .. 100 = open).
const KEYS = [
  { t: 0.0, v: [0, 95, -95, -10, 0, 40] },
  { t: 1.0, v: [25, 60, -60, -70, 10, 70] }, // approach, open
  { t: 1.6, v: [25, 45, -40, -85, 10, 70] }, // descend
  { t: 2.2, v: [25, 45, -40, -85, 10, 0] }, // grasp (command fully closed)
  { t: 3.2, v: [25, 80, -85, -60, 10, 0] }, // lift
  { t: 4.4, v: [-30, 60, -60, -75, -15, 0] }, // transport + place
  { t: 5.0, v: [-30, 50, -45, -85, -15, 70] }, // release
  { t: 6.0, v: [-10, 90, -90, -20, 0, 40] }, // retract
];
const PHASES = [
  { from: 0.0, to: 1.0, id: "approach" },
  { from: 1.0, to: 1.6, id: "descend" },
  { from: 1.6, to: 2.4, id: "grasp" },
  { from: 2.4, to: 3.2, id: "lift" },
  { from: 3.2, to: 4.6, id: "transport" },
  { from: 4.6, to: 5.2, id: "release" },
  { from: 5.2, to: 6.0, id: "retract" },
];

let seed = 0x5eed101;
function random() {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const noise = (amplitude) => (random() * 2 - 1) * amplitude;
const round = (value, digits = 2) => Number(value.toFixed(digits));
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);

function leader(t) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (t <= b.t) {
      const k = ease((t - a.t) / (b.t - a.t));
      return a.v.map((value, j) => value + (b.v[j] - value) * k);
    }
  }
  return KEYS[KEYS.length - 1].v.slice();
}

const actions = [];
for (let i = 0; i < N; i++) {
  const t = i / FPS;
  actions.push(leader(t).map((value, j) => value + (j === 5 ? 0 : noise(0.25))));
}
const holding = (t) => t >= 2.05 && t < 4.75;
const observations = [];
let previous = actions[0].slice();
for (let i = 0; i < N; i++) {
  const t = i / FPS;
  const next = JOINTS.map((joint, j) => {
    const source = actions[Math.max(0, i - DELAY[joint])][j];
    let value = previous[j] + (source - previous[j]) * ALPHA[joint];
    if (joint === "gripper" && holding(t)) value = Math.max(value, CUBE_WIDTH + noise(0.4));
    return value;
  });
  previous = next;
  observations.push(next.map((value, j) => value + noise(j === 5 ? 0.3 : 0.35)));
}

const phaseAt = (t) => PHASES.find((phase) => t >= phase.from && t < phase.to)?.id ?? "retract";
const frames = actions.map((action, i) => ({
  index: i,
  episode_index: 0,
  frame_index: i,
  timestamp: round(i / FPS, 4),
  "action": action.map((v) => round(v)),
  "observation.state": observations[i].map((v) => round(v)),
}));
const keyframes = [0, 30, 48, 66, 96, 132, 150, 179].map((i) => ({
  frame_index: i,
  timestamp: round(i / FPS, 4),
  phase: phaseAt(i / FPS),
  "observation.images.front": {
    path: "videos/observation.images.front/chunk-000/file-000.mp4",
    from_timestamp: 0,
    timestamp: round(i / FPS, 4),
    width: 640,
    height: 480,
  },
}));

const featureNames = JOINTS.map((joint) => `${joint}.pos`);
const dataset = {
  info: {
    codebase_version: "v3.0",
    robot_type: "so101_follower",
    fps: FPS,
    total_episodes: 1,
    total_frames: N,
    total_tasks: 1,
    chunks_size: 1000,
    data_path: "data/chunk-{chunk_index:03d}/file-{file_index:03d}.parquet",
    video_path: "videos/{video_key}/chunk-{chunk_index:03d}/file-{file_index:03d}.mp4",
    features: {
      action: { dtype: "float32", shape: [6], names: featureNames },
      "observation.state": { dtype: "float32", shape: [6], names: featureNames },
      "observation.images.front": {
        dtype: "video",
        shape: [480, 640, 3],
        names: ["height", "width", "channels"],
        info: { "video.codec": "av1", "video.fps": FPS },
      },
      timestamp: { dtype: "float32", shape: [1], names: null },
      frame_index: { dtype: "int64", shape: [1], names: null },
      episode_index: { dtype: "int64", shape: [1], names: null },
      index: { dtype: "int64", shape: [1], names: null },
    },
  },
  episode: {
    episode_index: 0,
    length: N,
    tasks: ["Pick the red cube and place it in the box"],
    phases: PHASES,
    synthetic: true,
  },
  keyframes,
  frames,
};

process.stdout.write(JSON.stringify(dataset) + "\n");

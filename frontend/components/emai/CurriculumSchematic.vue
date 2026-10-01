<!-- The curriculum drawn as a wiring schematic: skills are nodes, prerequisites are routed
     wires. Builder wires are orange, Decider wires teal. A filled junction means "all of these",
     an open diamond "one of these". -->
<template>
  <figure class="schem" :class="[`schem--${active ?? 'all'}`, { 'schem--ready': ready }]">
    <div class="schem__bar">
      <div class="schem__toggles" role="group" :aria-label="t('Emai.Curriculum.Track')">
        <button type="button" :aria-pressed="active === null" @click="active = null">
          {{ t("Emai.Curriculum.All") }}
        </button>
        <button type="button" class="is-decider" :aria-pressed="active === 'decider'" @click="toggle('decider')">
          <span class="swatch" aria-hidden="true"></span>{{ t("Emai.Tracks.Decider.Name") }}
        </button>
        <button type="button" class="is-builder" :aria-pressed="active === 'builder'" @click="toggle('builder')">
          <span class="swatch" aria-hidden="true"></span>{{ t("Emai.Tracks.Builder.Name") }}
        </button>
      </div>
    </div>

    <svg viewBox="0 0 620 360" role="img" :aria-label="t('Emai.Hero.DiagramLabel')" class="schem__svg">
      <defs>
        <pattern id="emai-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#2a2a2a" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="620" height="360" fill="url(#emai-grid)" />

      <g fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="square">
        <path
          v-for="(e, i) in edges"
          :key="e.id"
          :d="e.d"
          pathLength="1"
          class="wire"
          :class="[`wire--${e.track}`, { dim: active && active !== e.track }]"
          :style="{ '--delay': `${e.stage * 140 + i * 25}ms` }"
        />
      </g>

      <!-- junctions: all-of (dot) and any-of (diamond) -->
      <circle cx="250" cy="70" r="4" class="junction junction--builder" :class="{ dim: active === 'decider' }" />
      <rect
        x="500" y="120" width="9" height="9" transform="rotate(45 504.5 124.5)"
        class="junction-or" :class="{ dim: active === 'decider' }"
      />
      <text x="514" y="146" class="junction-label" :class="{ dim: active === 'decider' }">{{ t("Emai.Curriculum.Or") }}</text>

      <g v-for="n in nodes" :key="n.id" class="node" :class="[`node--${n.kind}`, { dim: isDim(n) }]">
        <rect :x="n.x - 20" :y="n.y - 20" width="40" height="40" rx="3" />
        <text :x="n.x" :y="n.y + 5" text-anchor="middle" class="node__id">{{ n.id }}</text>
        <text :x="n.x" :y="n.y + 38" text-anchor="middle" class="node__label">{{ t(`Emai.Skills.S${n.id}.Short`) }}</text>
      </g>
    </svg>

    <figcaption class="schem__caption">{{ t("Emai.Hero.Legend") }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
type Track = "decider" | "builder";
const active = ref<Track | null>(null);
const ready = ref(false);
onMounted(() => requestAnimationFrame(() => (ready.value = true)));

function toggle(track: Track) {
  active.value = active.value === track ? null : track;
}

const pos: Record<number, [number, number]> = {
  1: [60, 170],
  2: [190, 70],
  3: [190, 170],
  8: [190, 290],
  4: [310, 70],
  9: [310, 290],
  5: [430, 70],
  6: [430, 170],
  7: [560, 124],
};
const kinds: Record<number, "both" | Track> = {
  1: "both", 2: "builder", 3: "builder", 4: "builder", 5: "builder",
  6: "builder", 7: "builder", 8: "decider", 9: "decider",
};
const nodes = Object.entries(pos).map(([id, [x, y]]) => ({ id: Number(id), x, y, kind: kinds[Number(id)] }));

function isDim(n: { kind: string }) {
  return !!active.value && n.kind !== "both" && n.kind !== active.value;
}

// Orthogonal routes between node edges, like traces on a board.
const P = (id: number) => pos[id];
const edges = [
  { id: "1-2", track: "builder", stage: 0, d: `M${P(1)[0] + 20} 170 H125 V70 H${P(2)[0] - 20}` },
  { id: "1-3", track: "builder", stage: 0, d: `M${P(1)[0] + 20} 170 H${P(3)[0] - 20}` },
  { id: "1-8", track: "decider", stage: 0, d: `M${P(1)[0] + 20} 170 H125 V290 H${P(8)[0] - 20}` },
  { id: "2-4", track: "builder", stage: 1, d: `M${P(2)[0] + 20} 70 H${P(4)[0] - 20}` },
  { id: "3-4", track: "builder", stage: 1, d: `M${P(3)[0] + 20} 170 H250 V70` },
  { id: "8-9", track: "decider", stage: 1, d: `M${P(8)[0] + 20} 290 H${P(9)[0] - 20}` },
  { id: "3-6", track: "builder", stage: 2, d: `M250 170 H${P(6)[0] - 20}` },
  { id: "4-5", track: "builder", stage: 2, d: `M${P(4)[0] + 20} 70 H${P(5)[0] - 20}` },
  { id: "5-7", track: "builder", stage: 3, d: `M${P(5)[0] + 20} 70 H504 V124 H${P(7)[0] - 20}` },
  { id: "6-7", track: "builder", stage: 3, d: `M${P(6)[0] + 20} 170 H504 V124` },
] as const;
</script>

<style scoped>
.schem {
  position: relative;
  border: 1px solid var(--emai-line);
  border-radius: 6px;
  background: #171717;
  overflow: hidden;
}
.schem__bar {
  display: flex;
  justify-content: flex-end;
  padding: 0.7rem 0.8rem 0;
}
.schem__toggles {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.2rem;
  border: 1px solid var(--emai-line);
  border-radius: 5px;
  background: var(--emai-bg);
}
.schem__toggles button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.65rem;
  border-radius: 3px;
  font-size: 0.8rem;
  color: var(--emai-muted);
}
.schem__toggles button:hover {
  color: var(--emai-text);
}
.schem__toggles button[aria-pressed="true"] {
  background: var(--emai-surface-2);
  color: var(--emai-text);
}
.swatch {
  width: 10px;
  height: 2px;
}
.is-decider .swatch {
  background: var(--emai-teal);
}
.is-builder .swatch {
  background: var(--emai-orange);
}
.schem__svg {
  display: block;
  width: 100%;
  height: auto;
}
.schem__caption {
  padding: 0 1rem 0.9rem;
  font-size: 0.8rem;
  color: var(--emai-dim);
}

/* wires */
.wire {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: opacity 0.25s ease;
}
.schem--ready .wire {
  animation: draw 0.7s cubic-bezier(0.5, 0, 0.2, 1) var(--delay) forwards;
}
.wire--builder {
  stroke: var(--emai-orange);
}
.wire--decider {
  stroke: var(--emai-teal);
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .wire {
    stroke-dashoffset: 0;
    animation: none !important;
  }
}

.junction--builder {
  fill: var(--emai-orange);
}
.junction-or {
  fill: #171717;
  stroke: var(--emai-orange);
  stroke-width: 2;
}
.junction-label {
  font-family: var(--emai-font-mono);
  font-size: 10px;
  fill: var(--emai-dim);
}

/* nodes */
.node rect {
  fill: var(--emai-surface);
  stroke-width: 1.5;
  transition: opacity 0.25s ease;
}
.node--builder rect {
  stroke: var(--emai-orange);
}
.node--decider rect {
  stroke: var(--emai-teal);
}
.node--both rect {
  stroke: var(--emai-text);
  fill: var(--emai-surface-2);
}
.node__id {
  font-family: var(--emai-font-mono);
  font-size: 15px;
  font-weight: 600;
  fill: var(--emai-text);
}
.node__label {
  font-family: var(--emai-font-body);
  font-size: 11.5px;
  fill: var(--emai-muted);
}
.dim,
.node.dim {
  opacity: 0.16;
  transition: opacity 0.25s ease;
}
</style>

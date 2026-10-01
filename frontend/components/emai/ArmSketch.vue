<!-- Line drawing of a leader/follower SO-101 pair on a table (decorative). -->
<template>
  <svg viewBox="0 0 320 220" aria-hidden="true" class="arm">
    <defs>
      <pattern id="emai-arm-grid" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.9" fill="#2a2a2a" />
      </pattern>
    </defs>
    <rect width="320" height="220" fill="url(#emai-arm-grid)" />
    <line x1="16" y1="186" x2="304" y2="186" class="table" />
    <!-- leader (teal, human-operated) -->
    <g class="leader">
      <rect x="44" y="170" width="44" height="16" rx="2" />
      <path d="M66 170 V142 L96 104 L132 118" />
      <circle cx="66" cy="142" r="5" /><circle cx="96" cy="104" r="5" /><circle cx="132" cy="118" r="4" />
      <path d="M132 118 l10 -6 M132 118 l12 4" />
    </g>
    <!-- follower (orange, runs the policy) -->
    <g class="follower">
      <rect x="196" y="170" width="48" height="16" rx="2" />
      <path d="M220 170 V136 L252 92 L290 112" />
      <circle cx="220" cy="136" r="5.5" /><circle cx="252" cy="92" r="5.5" /><circle cx="290" cy="112" r="4.5" />
      <path d="M290 112 l12 -8 M290 112 l14 5" />
      <rect x="296" y="160" width="14" height="14" class="cube" />
    </g>
    <path d="M142 70 C 170 52, 196 52, 226 70" class="link" />
    <text x="184" y="46" text-anchor="middle" class="label">teleop</text>
  </svg>
</template>

<style scoped>
.arm {
  display: block;
  width: 100%;
  height: auto;
}
.table {
  stroke: var(--emai-line-strong);
  stroke-width: 2;
}
.leader,
.follower {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.leader {
  stroke: var(--emai-teal);
}
.follower {
  stroke: var(--emai-orange);
}
.leader circle,
.follower circle,
.leader rect,
.follower rect {
  fill: #171717;
  stroke-width: 2;
}
.cube {
  stroke: var(--emai-muted) !important;
}
.link {
  fill: none;
  stroke: var(--emai-dim);
  stroke-width: 1.5;
  stroke-dasharray: 4 5;
}
.label {
  font-family: var(--emai-font-mono);
  font-size: 11px;
  fill: var(--emai-dim);
}
</style>

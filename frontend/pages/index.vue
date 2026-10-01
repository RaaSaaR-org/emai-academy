<!-- EmAI Academy landing page (replaces upstream pages/index.vue). -->
<template>
  <main class="landing">
    <!-- Hero: the curriculum itself is the picture -->
    <section class="hero emai-wrap">
      <div class="hero__copy">
        <p class="hero__brand">{{ t("Emai.Tagline") }}</p>
        <h1 class="hero__title emai-display">{{ t("Emai.Hero.Title") }}</h1>
        <p class="hero__lead">{{ t("Emai.Hero.Lead") }}</p>
        <div class="hero__actions">
          <NuxtLink to="/auth/signup" class="emai-btn emai-btn--primary">{{ t("Emai.Hero.Register") }}</NuxtLink>
          <NuxtLink to="/skill-tree" class="emai-btn emai-btn--ghost">{{ t("Emai.Hero.SkillTree") }}</NuxtLink>
        </div>
      </div>
      <EmaiCurriculumSchematic class="hero__schematic" />
    </section>

    <!-- Principles -->
    <section class="principles emai-wrap" aria-label="EmAI">
      <div v-for="p in principles" :key="p" class="principle">
        <h2>{{ t(`Emai.Principles.${p}.Title`) }}</h2>
        <p>{{ t(`Emai.Principles.${p}.Body`) }}</p>
      </div>
    </section>

    <!-- Tracks -->
    <section id="lernpfade" class="block emai-wrap">
      <header class="block__head">
        <h2 class="emai-display block__title">{{ t("Emai.Tracks.Title") }}</h2>
        <p class="block__intro">{{ t("Emai.Tracks.Intro") }}</p>
      </header>

      <div class="tracks">
        <article v-for="tr in tracks" :key="tr.id" class="track" :class="`track--${tr.id}`">
          <h3 class="track__name">{{ t(`Emai.Tracks.${tr.key}.Name`) }}</h3>
          <p class="track__who">{{ t(`Emai.Tracks.${tr.key}.Who`) }}</p>
          <p class="track__body">{{ t(`Emai.Tracks.${tr.key}.Body`) }}</p>

          <ol class="route" :aria-label="t('Emai.Tracks.Path')">
            <li v-for="(stage, si) in emaiTrackStages[tr.id]" :key="si" class="route__stage">
              <template v-for="(id, ii) in stage" :key="id">
                <span v-if="ii > 0" class="route__or">{{ t("Emai.Curriculum.Or") }}</span>
                <span class="route__node" :title="t(`Emai.Skills.S${id}.Name`)">
                  <span class="emai-mono">{{ id }}</span> {{ t(`Emai.Skills.S${id}.Short`) }}
                </span>
              </template>
            </li>
          </ol>

          <p class="track__outcome">
            <strong>{{ t("Emai.Tracks.Outcome") }}</strong>
            {{ t(`Emai.Tracks.${tr.key}.Outcome`) }}
          </p>
        </article>
      </div>
    </section>

    <!-- Curriculum -->
    <section id="lehrplan" class="block emai-wrap">
      <header class="block__head">
        <h2 class="emai-display block__title">{{ t("Emai.Curriculum.Title") }}</h2>
        <p class="block__intro">{{ t("Emai.Curriculum.Intro") }}</p>
      </header>

      <ol class="skills">
        <li v-for="s in emaiSkills" :key="s.id" class="skill">
          <span class="skill__id emai-mono" :class="trackClass(s.tracks)">{{ s.id }}</span>
          <div class="skill__main">
            <h3>{{ t(`${s.key}.Name`) }}</h3>
            <p>{{ t(`${s.key}.Body`) }}</p>
          </div>
          <dl class="skill__meta">
            <div>
              <dt>{{ t("Emai.Curriculum.Requires") }}</dt>
              <dd class="emai-mono">{{ requiresText(s) }}</dd>
            </div>
            <div>
              <dt>{{ t("Emai.Tracks.Path") }}</dt>
              <dd class="skill__tracks">
                <span v-for="tr in s.tracks" :key="tr" :class="`tag tag--${tr}`">
                  {{ t(`Emai.Tracks.${tr === "decider" ? "Decider" : "Builder"}.Name`) }}
                </span>
              </dd>
            </div>
          </dl>
        </li>
      </ol>
    </section>

    <!-- Hardware lab -->
    <section id="hardware" class="lab">
      <div class="emai-hazard" aria-hidden="true"></div>
      <div class="emai-wrap lab__inner">
        <header class="block__head">
          <h2 class="emai-display block__title">{{ t("Emai.Lab.Title") }}</h2>
          <p class="block__intro">{{ t("Emai.Lab.Intro") }}</p>
        </header>

        <div class="robots">
          <article class="robot">
            <div class="robot__visual robot__visual--g1">
              <img src="/emai/g1-edu-hologram.webp" alt="Unitree G1 EDU" loading="lazy" />
            </div>
            <div class="robot__text">
              <p class="robot__kind">{{ t("Emai.Lab.G1.Kind") }}</p>
              <h3>{{ t("Emai.Lab.G1.Name") }}</h3>
              <p class="robot__body">{{ t("Emai.Lab.G1.Body") }}</p>
              <dl class="specs" :aria-label="t('Emai.Lab.Specs')">
                <div><dt>{{ t("Emai.Lab.G1.Height") }}</dt><dd>1,32 m</dd></div>
                <div><dt>{{ t("Emai.Lab.G1.Weight") }}</dt><dd>35 kg</dd></div>
                <div><dt>{{ t("Emai.Lab.G1.Dof") }}</dt><dd>23–43</dd></div>
                <div><dt>{{ t("Emai.Lab.G1.Hand") }}</dt><dd>{{ t("Emai.Lab.G1.HandValue") }}</dd></div>
                <div><dt>{{ t("Emai.Lab.G1.Sensors") }}</dt><dd>{{ t("Emai.Lab.G1.SensorsValue") }}</dd></div>
                <div><dt>{{ t("Emai.Lab.G1.Compute") }}</dt><dd>{{ t("Emai.Lab.G1.ComputeValue") }}</dd></div>
              </dl>
              <p class="robot__used">
                {{ t("Emai.Lab.UsedIn") }}:
                <span v-for="id in [2, 4, 7, 8]" :key="id" class="chip emai-mono">{{ id }}</span>
              </p>
            </div>
          </article>

          <article class="robot">
            <div class="robot__visual"><EmaiArmSketch /></div>
            <div class="robot__text">
              <p class="robot__kind">{{ t("Emai.Lab.SO101.Kind") }}</p>
              <h3>{{ t("Emai.Lab.SO101.Name") }}</h3>
              <p class="robot__body">{{ t("Emai.Lab.SO101.Body") }}</p>
              <dl class="specs" :aria-label="t('Emai.Lab.Specs')">
                <div><dt>{{ t("Emai.Lab.SO101.Dof") }}</dt><dd>{{ t("Emai.Lab.SO101.DofValue") }}</dd></div>
                <div><dt>{{ t("Emai.Lab.SO101.Setup") }}</dt><dd>{{ t("Emai.Lab.SO101.SetupValue") }}</dd></div>
                <div><dt>{{ t("Emai.Lab.SO101.Actuators") }}</dt><dd>{{ t("Emai.Lab.SO101.ActuatorsValue") }}</dd></div>
                <div><dt>{{ t("Emai.Lab.SO101.Software") }}</dt><dd>{{ t("Emai.Lab.SO101.SoftwareValue") }}</dd></div>
              </dl>
              <p class="robot__used">
                {{ t("Emai.Lab.UsedIn") }}:
                <span v-for="id in [3, 4, 5, 7]" :key="id" class="chip emai-mono">{{ id }}</span>
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Closing CTA -->
    <section class="cta emai-wrap">
      <div class="cta__box">
        <div>
          <h2 class="emai-display cta__title">{{ t("Emai.Cta.Title") }}</h2>
          <p class="cta__body">{{ t("Emai.Cta.Body") }}</p>
        </div>
        <div class="cta__actions">
          <NuxtLink to="/auth/signup" class="emai-btn emai-btn--primary">{{ t("Emai.Cta.Register") }}</NuxtLink>
          <NuxtLink to="/skill-tree" class="emai-btn emai-btn--ghost">{{ t("Emai.Cta.SkillTree") }}</NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

definePageMeta({ middleware: ["redirect-authenticated"] });

const { t, locale } = useI18n();
useHead({
  title: "EmAI Academy",
  htmlAttrs: { lang: computed(() => (locale.value == "de" ? "de" : "en")) },
});

const principles = ["Tested", "Neutral", "Open"];
const tracks = [
  { id: "decider" as const, key: "Decider" },
  { id: "builder" as const, key: "Builder" },
];

function trackClass(tr: string[]) {
  return tr.length > 1 ? "is-both" : `is-${tr[0]}`;
}
function requiresText(s: EmaiSkill) {
  if (!s.requires.length) return t("Emai.Curriculum.Entry");
  const joiner = s.mode === "any" ? ` ${t("Emai.Curriculum.Or")} ` : ` ${t("Emai.Curriculum.And")} `;
  return s.requires.join(joiner);
}
</script>

<style scoped>
.landing {
  padding-bottom: 2rem;
}

/* ---------- hero ---------- */
.hero {
  display: grid;
  gap: 2.5rem;
  align-items: center;
  padding-top: clamp(2.5rem, 6vw, 5rem);
  padding-bottom: clamp(2.5rem, 5vw, 4rem);
}
@media (min-width: 1024px) {
  .hero {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 3.5rem;
  }
}
.hero__brand {
  margin-bottom: 1.25rem;
  font-family: var(--emai-font-body);
  font-size: 0.95rem;
  color: var(--emai-orange);
}
.hero__title {
  font-size: clamp(2.2rem, 4.2vw, 3.6rem);
  text-wrap: balance;
  hyphens: manual;
  overflow-wrap: break-word;
}
.hero__lead {
  margin-top: 1.5rem;
  max-width: 34rem;
  font-size: 1.075rem;
  line-height: 1.65;
  color: var(--emai-muted);
}
.hero__actions {
  margin-top: 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

/* ---------- principles ---------- */
.principles {
  display: grid;
  gap: 0;
  border-top: 1px solid var(--emai-line);
  border-bottom: 1px solid var(--emai-line);
}
@media (min-width: 768px) {
  .principles {
    grid-template-columns: repeat(3, 1fr);
  }
}
.principle {
  padding: 1.75rem 0;
}
@media (min-width: 768px) {
  .principle {
    padding: 2rem 2rem 2rem 0;
  }
  .principle + .principle {
    padding-left: 2rem;
    border-left: 1px solid var(--emai-line);
  }
}
.principle + .principle {
  border-top: 1px solid var(--emai-line);
}
@media (min-width: 768px) {
  .principle + .principle {
    border-top: 0;
  }
}
.principle h2 {
  font-family: var(--emai-font-display);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--emai-text);
}
.principle p {
  margin-top: 0.5rem;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--emai-muted);
}

/* ---------- generic block ---------- */
.block {
  padding-top: clamp(4rem, 8vw, 6.5rem);
  scroll-margin-top: 1rem;
}
.block__head {
  max-width: 44rem;
  margin-bottom: 2.5rem;
}
.block__title {
  font-size: clamp(1.9rem, 3.6vw, 2.75rem);
  text-wrap: balance;
}
.block__intro {
  margin-top: 1rem;
  font-size: 1.05rem;
  line-height: 1.65;
  color: var(--emai-muted);
}

/* ---------- tracks ---------- */
.tracks {
  display: grid;
  gap: 1.25rem;
}
@media (min-width: 900px) {
  .tracks {
    grid-template-columns: 1fr 1fr;
  }
}
.track {
  --track: var(--emai-orange);
  position: relative;
  padding: 2rem;
  background: var(--emai-surface);
  border: 1px solid var(--emai-line);
  border-top: 3px solid var(--track);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
}
.track--decider {
  --track: var(--emai-teal);
}
.track__name {
  font-family: var(--emai-font-display);
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--emai-text);
}
.track__who {
  margin-top: 0.35rem;
  font-size: 0.95rem;
  color: var(--track);
}
.track__body {
  margin-top: 1rem;
  font-size: 1rem;
  line-height: 1.65;
  color: var(--emai-muted);
}
.route {
  margin: 1.75rem 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0;
}
.route__stage {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  line-height: 1;
}
.route__stage + .route__stage::before {
  content: "";
  width: 1.25rem;
  height: 2px;
  margin-right: 0.35rem;
  background: var(--track);
}
.route__node {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--emai-line-strong);
  border-radius: 3px;
  font-size: 0.85rem;
  color: var(--emai-text);
  background: var(--emai-bg);
}
.route__node .emai-mono {
  color: var(--track);
  font-weight: 600;
}
.route__or {
  font-size: 0.75rem;
  color: var(--emai-dim);
}
.track__outcome {
  margin-top: auto;
  padding-top: 1.25rem;
  border-top: 1px solid var(--emai-line);
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--emai-muted);
}
.track__outcome strong {
  color: var(--emai-text);
  font-weight: 600;
}

/* ---------- curriculum ---------- */
.skills {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid var(--emai-line);
}
.skill {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: 0.25rem 1.25rem;
  padding: 1.35rem 0;
  border-bottom: 1px solid var(--emai-line);
}
@media (min-width: 900px) {
  .skill {
    grid-template-columns: 3.5rem minmax(0, 1fr) 16rem;
    align-items: start;
  }
}
.skill__id {
  display: inline-grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1.5px solid var(--emai-orange);
  border-radius: 3px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--emai-text);
}
.skill__id.is-decider {
  border-color: var(--emai-teal);
}
.skill__id.is-both {
  border-color: var(--emai-text);
  background: var(--emai-surface-2);
}
.skill__main h3 {
  font-family: var(--emai-font-display);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--emai-text);
}
.skill__main p {
  margin-top: 0.25rem;
  max-width: 40rem;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--emai-muted);
}
.skill__meta {
  grid-column: 2;
  display: flex;
  gap: 1.5rem;
  margin-top: 0.5rem;
}
@media (min-width: 900px) {
  .skill__meta {
    grid-column: 3;
    margin-top: 0.2rem;
    justify-content: space-between;
  }
}
.skill__meta dt {
  font-size: 0.75rem;
  color: var(--emai-dim);
}
.skill__meta dd {
  margin-top: 0.2rem;
  font-size: 0.85rem;
  color: var(--emai-text);
}
.skill__tracks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.tag {
  padding: 0.1rem 0.45rem;
  border-radius: 2px;
  font-size: 0.78rem;
}
.tag--builder {
  color: var(--emai-orange);
  background: var(--emai-orange-wash);
}
.tag--decider {
  color: var(--emai-teal);
  background: var(--emai-teal-wash);
}

/* ---------- lab ---------- */
.lab {
  margin-top: clamp(4.5rem, 9vw, 7rem);
  background: #111111;
  border-bottom: 1px solid var(--emai-line);
  scroll-margin-top: 1rem;
}
.lab__inner {
  padding-top: clamp(3rem, 6vw, 4.5rem);
  padding-bottom: clamp(3rem, 6vw, 4.5rem);
}
.robots {
  display: grid;
  gap: 1.25rem;
}
@media (min-width: 1024px) {
  .robots {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
.robot {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--emai-bg);
  border: 1px solid var(--emai-line);
  border-radius: 4px;
  overflow: hidden;
}
.robot__visual {
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #171717;
  border-bottom: 1px solid var(--emai-line);
}
.robot__visual--g1 {
  background: radial-gradient(60% 70% at 50% 60%, rgba(255, 103, 0, 0.12), transparent 70%), #171717;
}
.robot__visual img,
.robot__visual :deep(svg) {
  height: 100%;
  width: 100%;
  object-fit: contain;
}
.robot__text {
  padding: 1.75rem;
}
.robot__kind {
  font-size: 0.85rem;
  color: var(--emai-orange);
}
.robot h3 {
  margin-top: 0.3rem;
  font-family: var(--emai-font-display);
  font-size: 1.45rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--emai-text);
}
.robot__body {
  margin-top: 0.6rem;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--emai-muted);
}
.specs {
  margin-top: 1.25rem;
  border-top: 1px solid var(--emai-line);
}
.specs > div {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: 1rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--emai-line);
}
@media (min-width: 640px) {
  .specs > div {
    grid-template-columns: 9.5rem minmax(0, 1fr);
  }
}
.specs dt {
  font-size: 0.85rem;
  color: var(--emai-dim);
}
.specs dd {
  font-family: var(--emai-font-mono);
  font-size: 0.82rem;
  color: var(--emai-text);
}
.robot__used {
  margin-top: 1.1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--emai-dim);
}
.chip {
  display: inline-grid;
  place-items: center;
  min-width: 1.6rem;
  height: 1.6rem;
  border: 1px solid var(--emai-line-strong);
  border-radius: 2px;
  font-size: 0.8rem;
  color: var(--emai-text);
}

/* ---------- CTA ---------- */
.cta {
  padding-top: clamp(4rem, 8vw, 6rem);
}
.cta__box {
  display: grid;
  gap: 2rem;
  align-items: end;
  padding: clamp(1.75rem, 4vw, 3rem);
  border: 1px solid var(--emai-line);
  border-left: 3px solid var(--emai-orange);
  border-radius: 4px;
  background: var(--emai-surface);
}
@media (min-width: 900px) {
  .cta__box {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}
.cta__title {
  font-size: clamp(1.8rem, 3.4vw, 2.6rem);
}
.cta__body {
  margin-top: 0.75rem;
  max-width: 36rem;
  font-size: 1.02rem;
  line-height: 1.6;
  color: var(--emai-muted);
}
.cta__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>

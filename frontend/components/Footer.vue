<!-- EmAI override of upstream components/Footer.vue: EmAI links, no social or commerce links. -->
<template>
  <footer class="emai-footer print:hidden">
    <div class="emai-footer__inner">
      <div class="emai-footer__brand">
        <EmaiLogo />
        <p class="emai-footer__about">{{ t("Emai.Footer.About") }}</p>
        <address class="emai-footer__address">
          EmAI Robotics GmbH<br />
          Halbergstraße 4<br />
          66121 Saarbrücken
        </address>
      </div>

      <nav class="emai-footer__col" :aria-label="t('Emai.Footer.Academy')">
        <h2>{{ t("Emai.Footer.Academy") }}</h2>
        <NuxtLink to="/">{{ t("Links.Home") }}</NuxtLink>
        <NuxtLink to="/skill-tree">{{ t("Links.SkillTree") }}</NuxtLink>
        <NuxtLink to="/auth/signup">{{ t("Emai.Nav.Signup") }}</NuxtLink>
        <NuxtLink to="/contact">{{ t("Links.Contact") }}</NuxtLink>
      </nav>

      <nav class="emai-footer__col" :aria-label="t('Emai.Footer.Company')">
        <h2>{{ t("Emai.Footer.Company") }}</h2>
        <a :href="`https://emai.dev/${locale == 'de' ? 'de' : 'en'}`" target="_blank" rel="noopener">{{ t("Emai.Footer.Website") }}</a>
        <a :href="`https://emai.dev/${locale == 'de' ? 'de' : 'en'}/knowledge`" target="_blank" rel="noopener">Knowledge</a>
        <a href="mailto:info@EmAI.dev">info@EmAI.dev</a>
      </nav>

      <nav class="emai-footer__col" :aria-label="t('Emai.Footer.Legal')">
        <h2>{{ t("Emai.Footer.Legal") }}</h2>
        <NuxtLink to="/docs/imprint">{{ t("Links.Imprint") }}</NuxtLink>
        <NuxtLink to="/docs/privacy">{{ t("Links.Privacy") }}</NuxtLink>
        <NuxtLink to="/docs/terms-and-conditions">{{ t("Emai.Footer.Terms") }}</NuxtLink>
      </nav>
    </div>

    <div class="emai-footer__base">
      <p>© {{ new Date().getFullYear() }} {{ t("Body.Copyright") }}.</p>
      <p>{{ t("Emai.Footer.PrototypeNote") }}</p>
      <p class="emai-footer__made">{{ t("Emai.Footer.MadeIn") }}</p>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
const { t, locale } = useI18n();
</script>

<style scoped>
.emai-footer {
  position: relative;
  z-index: 0;
  margin-top: 4rem;
  border-top: 1px solid var(--emai-line);
  background: #101010;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.emai-footer__inner {
  max-width: 76rem;
  margin-inline: auto;
  padding: 3.5rem clamp(1.25rem, 4vw, 2.5rem) 2.5rem;
  display: grid;
  gap: 2.5rem;
  grid-template-columns: 1fr;
}
@media (min-width: 768px) {
  .emai-footer__inner {
    grid-template-columns: 1.6fr 1fr 1fr 1fr;
  }
}
.emai-footer__about {
  margin-top: 1rem;
  max-width: 22rem;
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--emai-muted);
}
.emai-footer__address {
  margin-top: 1rem;
  font-style: normal;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--emai-dim);
}
.emai-footer__col {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.emai-footer__col h2 {
  margin-bottom: 0.4rem;
  font-family: var(--emai-font-display);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--emai-text);
}
.emai-footer__col a {
  width: fit-content;
  font-size: 0.92rem;
  color: var(--emai-muted);
}
.emai-footer__col a:hover {
  color: var(--emai-orange);
}
.emai-footer__base {
  max-width: 76rem;
  margin-inline: auto;
  padding: 1.25rem clamp(1.25rem, 4vw, 2.5rem) 1.75rem;
  border-top: 1px solid var(--emai-line);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2rem;
  justify-content: space-between;
}
.emai-footer__base p {
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--emai-dim);
}
.emai-footer__base .emai-footer__made {
  color: var(--emai-orange);
  font-weight: 600;
}
</style>

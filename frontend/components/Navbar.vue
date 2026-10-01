<!-- EmAI override of upstream components/Navbar.vue (same props: links, authorized). -->
<template>
  <header class="emai-nav print:hidden">
    <div class="emai-nav__inner">
      <NuxtLink :to="authorized ? '/dashboard' : '/'" class="emai-nav__brand hidden lg:flex">
        <EmaiLogo />
      </NuxtLink>
      <div class="flex items-center gap-4 lg:hidden">
        <NavbarDrawer :links="links" :authorized="authorized" />
        <NuxtLink :to="authorized ? '/dashboard' : '/'"><EmaiLogo compact /></NuxtLink>
      </div>

      <nav class="emai-nav__links hidden lg:flex" aria-label="Hauptnavigation">
        <NuxtLink
          v-for="{ label, pathname } of links"
          :key="label"
          :to="pathname"
          class="emai-nav__link"
          :exactActiveClass="pathname.includes('#') ? 'hash-link' : 'active'"
        >
          {{ t(label) }}
        </NuxtLink>
      </nav>

      <div class="emai-nav__end">
        <NavbarMenu v-if="authorized" />
        <template v-else>
          <NuxtLink to="/auth/login" class="emai-nav__login">{{ t("Emai.Nav.Login") }}</NuxtLink>
          <NuxtLink to="/auth/signup" class="emai-btn emai-btn--primary emai-nav__cta">
            {{ t("Emai.Nav.Signup") }}
          </NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

defineProps({
  links: { type: Array as PropType<{ label: string; pathname: string }[]>, default: () => [] },
  authorized: { type: Boolean, default: false },
});
const { t } = useI18n();
</script>

<style scoped>
.emai-nav {
  position: relative;
  z-index: 40;
  border-bottom: 1px solid var(--emai-line);
  background: var(--emai-bg);
}
.emai-nav__inner {
  max-width: 76rem;
  margin-inline: auto;
  padding: 0.9rem clamp(1.25rem, 4vw, 2.5rem);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}
.emai-nav__links {
  gap: 0.25rem;
}
.emai-nav__link {
  position: relative;
  padding: 0.5rem 0.85rem;
  font-family: var(--emai-font-body);
  font-size: 0.95rem;
  color: var(--emai-muted);
  border-radius: 4px;
}
.emai-nav__link:hover {
  color: var(--emai-text);
  background: var(--emai-surface);
}
.emai-nav__link.active {
  color: var(--emai-text);
}
.emai-nav__link.active::after {
  content: "";
  position: absolute;
  left: 0.85rem;
  right: 0.85rem;
  bottom: -0.95rem;
  height: 2px;
  background: var(--emai-orange);
}
.emai-nav__end {
  display: flex;
  align-items: center;
  gap: 1.1rem;
}
.emai-nav__login {
  font-size: 0.95rem;
  color: var(--emai-text);
}
.emai-nav__login:hover {
  color: var(--emai-orange);
}
.emai-nav__cta {
  padding: 0.55rem 1rem;
  font-size: 0.9rem;
}
@media (max-width: 420px) {
  .emai-nav__login {
    display: none;
  }
}
</style>

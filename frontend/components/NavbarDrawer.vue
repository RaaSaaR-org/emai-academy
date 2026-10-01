<!-- EmAI override of upstream components/NavbarDrawer.vue (mobile navigation). -->
<template>
  <div>
    <button type="button" class="emai-burger" :aria-expanded="show" aria-label="Menü" @click="toggleMenu">
      <Bars3Icon class="h-6 w-6" />
    </button>

    <Transition name="drawer">
      <section v-if="show" class="fixed inset-0 z-[10000] emai-scrim" @click.self="closeMenu">
        <aside class="emai-drawer">
          <div class="flex items-center justify-between">
            <NuxtLink :to="authorized ? '/dashboard' : '/'" @click="closeMenu"><EmaiLogo /></NuxtLink>
            <button type="button" class="emai-burger" aria-label="Schließen" @click="closeMenu">
              <XMarkIcon class="h-6 w-6" />
            </button>
          </div>

          <nav class="mt-10 flex flex-col">
            <NuxtLink
              v-for="({ label, pathname }, i) of links"
              :key="i"
              :to="pathname"
              class="emai-drawer__link"
              :exactActiveClass="pathname.includes('#') ? 'hash-link' : 'active'"
              @click="closeMenu"
            >
              {{ t(label) }}
            </NuxtLink>
          </nav>

          <div v-if="!authorized" class="mt-10 flex flex-col gap-3">
            <NuxtLink to="/auth/signup" class="emai-btn emai-btn--primary justify-center" @click="closeMenu">
              {{ t("Emai.Nav.Signup") }}
            </NuxtLink>
            <NuxtLink to="/auth/login" class="emai-btn emai-btn--ghost justify-center" @click="closeMenu">
              {{ t("Emai.Nav.Login") }}
            </NuxtLink>
          </div>
        </aside>
      </section>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { Bars3Icon, XMarkIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "vue-i18n";

defineProps({
  links: { type: Array as PropType<{ label: string; pathname: string }[]>, default: () => [] },
  authorized: { type: Boolean, default: false },
});
const { t } = useI18n();
const show = ref(false);
function closeMenu() {
  show.value = false;
}
function toggleMenu() {
  show.value = !show.value;
}
</script>

<style scoped>
.emai-scrim {
  background: rgba(0, 0, 0, 0.6);
}
.emai-burger {
  display: inline-flex;
  padding: 0.3rem;
  color: var(--emai-text);
  border-radius: 4px;
}
.emai-drawer {
  height: 100%;
  width: min(20rem, 86vw);
  background: var(--emai-surface);
  border-right: 1px solid var(--emai-line);
  padding: 1.25rem 1.5rem;
}
.emai-drawer__link {
  padding: 0.9rem 0;
  border-bottom: 1px solid var(--emai-line);
  font-family: var(--emai-font-display);
  font-size: 1.15rem;
  color: var(--emai-text);
}
.emai-drawer__link.active {
  color: var(--emai-orange);
}
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-active .emai-drawer,
.drawer-leave-active .emai-drawer {
  transition: transform 0.25s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .emai-drawer,
.drawer-leave-to .emai-drawer {
  transform: translateX(-100%);
}
</style>

<!-- EmAI override of upstream components/NavbarMenu.vue: no hearts, coins, premium badge,
     subscription or leaderboard; only account links and logout. -->
<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="emai-avatar-btn"
      :aria-expanded="show"
      aria-haspopup="menu"
      @click="show = !show"
    >
      <Avatar :name="displayName" class="h-9 min-h-[2.25rem] w-9 min-w-[2.25rem]" />
      <span class="hidden max-w-[10rem] truncate md:inline">{{ displayName }}</span>
      <ChevronDownIcon class="h-4 w-4 opacity-70" />
    </button>

    <Transition name="menu">
      <nav v-if="show" class="emai-menu" role="menu">
        <NuxtLink
          v-for="({ label, pathname }, i) of links"
          :key="i"
          :to="pathname"
          class="emai-menu__item"
          role="menuitem"
          @click="show = false"
        >
          {{ t(label) }}
        </NuxtLink>
        <button type="button" class="emai-menu__item emai-menu__logout" role="menuitem" @click="onclickLogout">
          {{ t("Buttons.Logout") }}
        </button>
      </nav>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from "@heroicons/vue/20/solid";
import { onClickOutside } from "@vueuse/core";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const show = ref(false);
const root = ref<HTMLElement | null>(null);
onClickOutside(root, () => (show.value = false));

const links = [
  { label: "CharacterDashboard.Nav", pathname: "/dashboard" },
  { label: "Links.SkillTree", pathname: "/skill-tree" },
  { label: "Links.MyAccount", pathname: "/account" },
];

const user = useUser();
const displayName = computed(() => (user?.value as any)?.display_name ?? "");

async function onclickLogout() {
  show.value = false;
  try {
    await logout();
  } catch {}
}
</script>

<style scoped>
.emai-avatar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.2rem 0.5rem 0.2rem 0.2rem;
  border: 1px solid var(--emai-line);
  border-radius: 999px;
  color: var(--emai-text);
  font-size: 0.9rem;
}
.emai-avatar-btn:hover {
  border-color: var(--emai-line-strong);
}
.emai-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.5rem);
  z-index: 50;
  width: 14rem;
  padding: 0.35rem;
  display: grid;
  background: var(--emai-surface);
  border: 1px solid var(--emai-line);
  border-radius: 6px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
}
.emai-menu__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-radius: 4px;
  font-size: 0.95rem;
  color: var(--emai-text);
}
.emai-menu__item:hover {
  background: var(--emai-surface-2);
}
.emai-menu__logout {
  margin-top: 0.25rem;
  border-top: 1px solid var(--emai-line);
  border-radius: 0 0 4px 4px;
  color: var(--emai-muted);
}
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

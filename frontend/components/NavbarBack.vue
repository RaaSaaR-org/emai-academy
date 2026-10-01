<!-- EmAI override of upstream components/NavbarBack.vue (used by layouts/inner.vue).
     Same back-target logic minus the pruned Bootstrap routes (morphcoins, challenges). -->
<template>
  <header class="emai-back print:hidden">
    <div class="emai-back__inner">
      <button type="button" class="emai-back__btn" @click="onclickNavigate">
        <ArrowLeftIcon class="h-4 w-4" />
        {{ t(backRoute.label) }}
      </button>
      <NuxtLink :to="authorized ? '/dashboard' : '/'" class="emai-back__brand"><EmaiLogo compact /></NuxtLink>
      <div id="navbar-back-end" class="emai-back__end"></div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ArrowLeftIcon } from "@heroicons/vue/20/solid";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const accessToken = useAccessToken();
const authorized = computed(() => !!accessToken.value);

const toDashboard = { pathname: "/dashboard", label: "CharacterDashboard.Nav" };

const backRoute = computed(() => {
  const name = String(route.name ?? "");
  if (name == "auth-signup" || name == "auth-forgot-password") return { pathname: "/auth/login", label: "Links.Login" };
  if (name == "auth-verify-account") return { pathname: "/auth/login", label: "Links.GoBack" };
  if (name == "auth-reset-password") return { pathname: "/auth/forgot-password", label: "Links.ForgotPassword" };
  if (name == "auth-login") return { pathname: "/", label: "Links.Home" };
  if (name.startsWith("account-mfa") || name.startsWith("profile-")) return toDashboard;
  return { pathname: "", label: "Links.GoBack" };
});

function onclickNavigate() {
  if (backRoute.value.pathname) router.push(backRoute.value.pathname);
  else if (window.history.length > 2) router.go(-1);
  else router.push("/");
}
</script>

<style scoped>
.emai-back {
  border-bottom: 1px solid var(--emai-line);
  background: var(--emai-bg);
}
.emai-back__inner {
  max-width: 76rem;
  margin-inline: auto;
  padding: 0.8rem clamp(1.25rem, 4vw, 2.5rem);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
}
.emai-back__btn {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.92rem;
  color: var(--emai-muted);
}
.emai-back__btn:hover {
  color: var(--emai-text);
}
.emai-back__end {
  justify-self: end;
}
</style>

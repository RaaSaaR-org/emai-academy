<template>
  <span class="emai-logo" :class="{ 'emai-logo--compact': compact }">
    <img src="/emai/logo.svg" alt="" aria-hidden="true" class="emai-logo__mark" />
    <span class="emai-logo__word">
      <span class="emai-logo__em">Em</span><span class="emai-logo__ai">AI</span>
      <span v-if="!compact" class="emai-logo__product">Academy</span>
    </span>
    <span class="sr-only">{{ t("AltAttributes.BootstrapAcademyLogo") }}</span>
  </span>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
defineProps<{ compact?: boolean }>();
const { t } = useI18n();
</script>

<style scoped>
.emai-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  white-space: nowrap;
}
.emai-logo__mark {
  width: 2rem;
  height: 2rem;
}
.emai-logo__word {
  font-family: var(--emai-font-display);
  font-weight: 700;
  font-size: 1.3rem;
  letter-spacing: -0.03em;
  line-height: 1;
}
.emai-logo__em {
  color: var(--emai-text);
}
.emai-logo__ai {
  color: var(--emai-orange);
}
.emai-logo__product {
  margin-left: 0.4rem;
  font-weight: 500;
  color: var(--emai-muted);
  letter-spacing: -0.01em;
}
.emai-logo--compact .emai-logo__mark {
  width: 1.5rem;
  height: 1.5rem;
}
.emai-logo--compact .emai-logo__word {
  font-size: 1.05rem;
}
</style>

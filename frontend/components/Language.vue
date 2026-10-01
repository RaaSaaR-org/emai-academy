<!-- EmAI override: slim utility strip with a text language toggle (replaces the flag bar).
     Keeps upstream behaviour: the locale cookie is only written when the user picks a language. -->
<template>
  <section class="emai-strip print:hidden" :aria-label="locale == 'de' ? 'Sprache' : 'Language'">
    <div class="emai-strip__inner">
      <span class="emai-strip__note">
        <span class="emai-strip__dot" aria-hidden="true"></span>
        {{ t("Emai.Prototype") }}
      </span>
      <div class="emai-strip__langs" role="group">
        <button
          type="button"
          :aria-pressed="locale == 'de'"
          :class="{ active: locale == 'de' }"
          @click="locale = 'de'"
        >
          DE
        </button>
        <span aria-hidden="true" class="emai-strip__sep">/</span>
        <button
          type="button"
          :aria-pressed="locale == 'en-US'"
          :class="{ active: locale == 'en-US' }"
          @click="locale = 'en-US'"
        >
          EN
        </button>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { useI18n } from "vue-i18n";

export default {
  props: {
    // upstream passes a background class; the EmAI strip has a fixed look
    color: { type: String, default: "" },
  },
  setup() {
    const { t, locale } = useI18n();
    const cookie_locale = useAppCookie("locale");

    watch(
      () => locale.value,
      (newValue, oldValue) => {
        if (newValue === oldValue) return;
        cookie_locale.value = newValue;
        if (import.meta.client) document.documentElement.lang = newValue == "de" ? "de" : "en";
      }
    );

    return { locale, t };
  },
};
</script>

<style scoped>
.emai-strip {
  width: 100%;
  border-bottom: 1px solid var(--emai-line);
  background: #101010;
}
.emai-strip__inner {
  max-width: 76rem;
  margin-inline: auto;
  padding: 0.35rem clamp(1.25rem, 4vw, 2.5rem);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--emai-font-mono);
  font-size: 0.72rem;
  color: var(--emai-dim);
}
.emai-strip__note {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}
.emai-strip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--emai-teal);
}
.emai-strip__langs {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.emai-strip__langs button {
  font: inherit;
  color: var(--emai-dim);
  padding: 0.1rem 0.25rem;
  border-radius: 2px;
}
.emai-strip__langs button:hover {
  color: var(--emai-text);
}
.emai-strip__langs button.active {
  color: var(--emai-text);
}
.emai-strip__sep {
  color: var(--emai-line-strong);
}
</style>

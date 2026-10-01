<!-- EmAI override of upstream pages/docs/terms-and-conditions.vue. PROTOTYPE PLACEHOLDER:
     no valid terms yet. Kept at this path because the signup form and the terms gate link here. -->
<template>
  <main class="emai-legal">
    <div class="emai-legal__body">
      <h1>{{ t("Emai.Terms.Title") }}</h1>
      <p class="emai-legal__sub">EmAI Academy · EmAI Robotics GmbH</p>

      <div class="emai-legal__note" role="note">
        <strong>{{ t("Emai.Terms.Notice") }}</strong>
        <p>{{ t("Emai.Terms.NoticeBody") }}</p>
      </div>

      <section>
        <p>{{ t("Emai.Terms.Summary") }}</p>
        <p>
          {{ t("Emai.Terms.Contact") }}
          <a href="mailto:info@EmAI.dev">info@EmAI.dev</a>
        </p>
        <p>
          <NuxtLink to="/docs/privacy">{{ t("Links.Privacy") }}</NuxtLink>
          ·
          <NuxtLink to="/docs/imprint">{{ t("Links.Imprint") }}</NuxtLink>
        </p>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
const { t } = useI18n();
useHead({ title: computed(() => `${t("Emai.Terms.Title")} · EmAI Academy`) });
</script>

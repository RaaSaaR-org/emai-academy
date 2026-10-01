<!-- EmAI override of upstream pages/docs/imprint.vue. Text source: emai/landing-page
     src/i18n/locales/{de,en}/legal.json (copied to locales/legal/). -->
<template>
  <main class="emai-legal">
    <div class="emai-legal__body">
      <h1>{{ L.title }}</h1>
      <p class="emai-legal__sub">{{ L.subtitle }}</p>

      <section>
        <h2>{{ L.company.title }}</h2>
        <p>
          {{ L.company.name }}<br />
          <template v-if="L.company.legalForm">{{ L.company.legalForm }}<br /></template>
          {{ L.company.street }}<br />
          {{ L.company.city }}<br />
          {{ L.company.country }}
        </p>
        <p v-if="L.company.seat">{{ L.company.seat }}</p>
      </section>

      <section>
        <h2>{{ L.contact.title }}</h2>
        <p v-if="L.contact.phone">{{ L.contact.phone }}</p>
        <p>
          {{ L.contact.email.replace("info@EmAI.dev", "") }}<a href="mailto:info@EmAI.dev">info@EmAI.dev</a>
        </p>
      </section>

      <section>
        <h2>{{ L.representation.title }}</h2>
        <p>{{ L.representation.text }}</p>
      </section>

      <section v-if="L.register.court || L.register.number">
        <h2>{{ L.register.title }}</h2>
        <p>
          <template v-if="L.register.court">{{ L.register.court }}<br /></template>
          {{ L.register.number }}
        </p>
      </section>

      <section v-if="L.vat.number">
        <h2>{{ L.vat.title }}</h2>
        <p>{{ L.vat.text }} {{ L.vat.number }}</p>
      </section>

      <section>
        <h2>{{ L.responsible.title }}</h2>
        <p>{{ L.responsible.subtitle }}</p>
        <p>
          {{ L.responsible.name }}<br />
          {{ L.responsible.street }}<br />
          {{ L.responsible.city }}
        </p>
      </section>

      <section>
        <h2>{{ L.dispute.title }}</h2>
        <p>{{ L.dispute.text }}</p>
        <p><a :href="L.dispute.link" target="_blank" rel="noopener noreferrer">{{ L.dispute.link }}</a></p>
        <p>{{ L.dispute.note }}</p>
      </section>

      <section>
        <h2>{{ L.liability.title }}</h2>
        <p>{{ L.liability.text }}</p>
      </section>

      <section>
        <h2>{{ L.links.title }}</h2>
        <p>{{ L.links.text }}</p>
      </section>

      <section>
        <h2>{{ L.copyright.title }}</h2>
        <p>{{ L.copyright.text }}</p>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import de from "../../locales/legal/de.json";
import en from "../../locales/legal/en.json";

const { locale } = useI18n();
const L = computed(() => (locale.value == "de" ? de : en).impressum);
useHead({ title: computed(() => `${L.value.title} · EmAI Academy`) });
</script>

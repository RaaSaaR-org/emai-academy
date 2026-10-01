<!-- EmAI override of upstream pages/docs/privacy.vue. Website sections come from emai/landing-page
     src/i18n/locales/{de,en}/legal.json (copied to locales/legal/); the hosting and the
     learning-platform sections are academy-specific and marked as prototype drafts. -->
<template>
  <main class="emai-legal">
    <div class="emai-legal__body">
      <h1>{{ D.title }}</h1>
      <p class="emai-legal__sub">{{ D.lastUpdated }}</p>

      <div class="emai-legal__note">
        <strong>{{ A.noteTitle }}</strong>
        <p>{{ A.noteBody }}</p>
      </div>

      <section>
        <h2>{{ D.intro.title }}</h2>
        <h3>{{ D.intro.general.title }}</h3>
        <p>{{ D.intro.general.text }}</p>
        <h3>{{ D.intro.collection.title }}</h3>
        <template v-for="k in ['responsible', 'how', 'purpose', 'rights']" :key="k">
          <h3>{{ D.intro.collection[k].q }}</h3>
          <p>{{ D.intro.collection[k].a }}</p>
        </template>
      </section>

      <section>
        <h2>{{ A.hostingTitle }}</h2>
        <p v-for="(p, i) in A.hosting" :key="i">{{ p }}</p>
      </section>

      <section>
        <h2>{{ D.general.title }}</h2>
        <template v-for="k in generalKeys" :key="k">
          <h3>{{ D.general[k].title }}</h3>
          <template v-if="k === 'controller'">
            <p>{{ D.general.controller.text }}</p>
            <p>
              {{ D.general.controller.company }}<br />
              {{ D.general.controller.street }}<br />
              {{ D.general.controller.city }}<br />
              <a href="mailto:info@EmAI.dev">info@EmAI.dev</a>
            </p>
            <p>{{ D.general.controller.note }}</p>
          </template>
          <p v-else>{{ D.general[k].text }}</p>
        </template>
      </section>

      <section>
        <h2>{{ A.platformTitle }}</h2>
        <template v-for="(s, i) in A.platform" :key="i">
          <h3>{{ s.title }}</h3>
          <p>{{ s.text }}</p>
          <ul v-if="s.items">
            <li v-for="(it, j) in s.items" :key="j">{{ it }}</li>
          </ul>
        </template>
      </section>

      <section>
        <h2>{{ A.contactTitle }}</h2>
        <template v-for="k in ['email', 'contact']" :key="k">
          <h3>{{ D.collection[k].title }}</h3>
          <p>{{ D.collection[k].text }}</p>
          <p>{{ D.collection[k].basis }}</p>
          <p>{{ D.collection[k].retention }}</p>
        </template>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import de from "../../locales/legal/de.json";
import en from "../../locales/legal/en.json";

const { locale } = useI18n();
const isDe = computed(() => locale.value == "de");
const D = computed<any>(() => (isDe.value ? de : en).datenschutz);

const generalKeys = [
  "privacy", "controller", "retention", "legal", "recipient", "revocation",
  "objection", "complaint", "portability", "access", "restriction", "ssl",
];

const academy = {
  de: {
    noteTitle: "Prototyp – Entwurf",
    noteBody:
      "Die EmAI Academy befindet sich in der Erprobung. Die Abschnitte zu Hosting und Lernplattform sind ein Entwurf und werden vor dem öffentlichen Start rechtlich geprüft und vervollständigt.",
    hostingTitle: "2. Hosting",
    hosting: [
      "Die EmAI Academy wird im Prototyp-Betrieb auf Systemen der EmAI Robotics GmbH betrieben. Der Anbieter für den Produktivbetrieb wird vor dem öffentlichen Start hier genannt; geplant ist ein Hosting in Rechenzentren innerhalb der Europäischen Union.",
      "Beim Aufruf der Lernplattform verarbeiten unsere Server technisch notwendige Daten (IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browserkennung) in Protokolldateien, um den sicheren Betrieb zu gewährleisten (Art. 6 Abs. 1 lit. f DSGVO).",
    ],
    platformTitle: "5. Nutzerkonto und Lernplattform",
    platform: [
      {
        title: "Registrierung und Nutzerkonto",
        text: "Für die Nutzung der Lernplattform legen Sie ein Konto an. Wir verarbeiten dabei die Daten, die zur Bereitstellung des Kontos erforderlich sind (Art. 6 Abs. 1 lit. b DSGVO):",
        items: [
          "Benutzername, Anzeigename und E-Mail-Adresse",
          "Passwort (nur als kryptografischer Hash gespeichert) und, falls aktiviert, Daten zur Zwei-Faktor-Anmeldung",
          "Zeitpunkt der Registrierung und der Bestätigung Ihrer E-Mail-Adresse",
        ],
      },
      {
        title: "Lernfortschritt",
        text: "Damit Skilltree, Kurse und Lernräume funktionieren, speichern wir Ihren Lernfortschritt: abgeschlossene Lektionen, Antworten auf Übungen und Quizze, gesammelte Erfahrungspunkte und freigeschaltete Skills. Diese Daten nutzen wir ausschließlich zum Betrieb der Plattform (Art. 6 Abs. 1 lit. b DSGVO).",
      },
      {
        title: "Eingebettete Videos (YouTube)",
        text: "Einige Kurse enthalten Videos, die auf YouTube veröffentlicht sind. Wir binden sie im erweiterten Datenschutzmodus (youtube-nocookie.com) und erst nach Ihrem Klick ein: Solange Sie ein Video nicht über „Video laden“ starten, baut Ihr Browser keine Verbindung zu YouTube auf. Nach dem Klick lädt Ihr Browser das Video von Servern der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Dabei werden mindestens Ihre IP-Adresse, die aufgerufene Seite und technische Daten Ihres Browsers an Google übertragen; YouTube kann Cookies oder vergleichbare Technologien einsetzen. Eine Übermittlung in die USA ist möglich; sie stützt sich auf den Angemessenheitsbeschluss zum EU-US Data Privacy Framework. Rechtsgrundlage ist Ihre Einwilligung durch den Klick (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Sie gilt nur für das jeweilige Video; laden Sie kein Video, findet keine Übertragung statt. Details: https://policies.google.com/privacy",
      },
      {
        title: "Cookies und lokaler Speicher",
        text: "Die Lernplattform setzt nur technisch notwendige Cookies bzw. Einträge im lokalen Speicher Ihres Browsers: Anmelde-Token für Ihre Sitzung und Ihre gewählte Sprache (§ 25 Abs. 2 Nr. 2 TDDDG). Wir verwenden keine Analyse- oder Marketing-Cookies.",
      },
      {
        title: "Löschung Ihres Kontos",
        text: "Sie können Ihr Konto jederzeit unter „Mein Konto“ löschen. Dabei werden Ihre Kontodaten und Ihr Lernfortschritt gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.",
      },
    ],
    contactTitle: "6. Kontaktaufnahme",
  },
  en: {
    noteTitle: "Prototype – draft",
    noteBody:
      "EmAI Academy is being trialled. The hosting and learning platform sections are a draft and will be legally reviewed and completed before the public launch.",
    hostingTitle: "2. Hosting",
    hosting: [
      "During the prototype phase, EmAI Academy runs on systems operated by EmAI Robotics GmbH. The provider for production operation will be named here before the public launch; hosting in data centres within the European Union is planned.",
      "When you use the learning platform, our servers process technically necessary data (IP address, time, requested address, browser identifier) in log files to keep operations secure (Art. 6(1)(f) GDPR).",
    ],
    platformTitle: "5. User account and learning platform",
    platform: [
      {
        title: "Registration and user account",
        text: "To use the learning platform you create an account. We process the data required to provide the account (Art. 6(1)(b) GDPR):",
        items: [
          "Username, display name and email address",
          "Password (stored only as a cryptographic hash) and, if enabled, two-factor authentication data",
          "Time of registration and of your email confirmation",
        ],
      },
      {
        title: "Learning progress",
        text: "For the skill tree, courses and learning rooms to work, we store your learning progress: completed lessons, answers to exercises and quizzes, experience points and unlocked skills. We use this data only to operate the platform (Art. 6(1)(b) GDPR).",
      },
      {
        title: "Embedded videos (YouTube)",
        text: "Some courses contain videos published on YouTube. We embed them in privacy-enhanced mode (youtube-nocookie.com) and only after you click: as long as you do not start a video with “Load video”, your browser makes no connection to YouTube. After the click, your browser loads the video from servers of Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland. At least your IP address, the page you are on and technical browser data are transmitted to Google; YouTube may use cookies or similar technologies. A transfer to the USA is possible; it is based on the adequacy decision for the EU-US Data Privacy Framework. The legal basis is your consent given by the click (Art. 6(1)(a) GDPR, Section 25(1) TDDDG). It only applies to that video; if you load no video, nothing is transmitted. Details: https://policies.google.com/privacy",
      },
      {
        title: "Cookies and local storage",
        text: "The learning platform only sets technically necessary cookies or local storage entries: sign-in tokens for your session and your chosen language (Section 25(2) no. 2 TDDDG). We do not use analytics or marketing cookies.",
      },
      {
        title: "Deleting your account",
        text: "You can delete your account at any time under “My Account”. This deletes your account data and learning progress unless statutory retention obligations apply.",
      },
    ],
    contactTitle: "6. Contacting us",
  },
};
const A = computed(() => (isDe.value ? academy.de : academy.en));
useHead({ title: computed(() => `${D.value.title} · EmAI Academy`) });
</script>

<!-- EmAI override of upstream layouts/default.vue: nav links without challenges. -->
<template>
  <div class="relative">
    <Language />
    <Navbar :links="links" :authorized="authorized" />
    <slot />
  </div>
</template>

<script setup lang="ts">
const accessToken = useAccessToken();
const authorized = computed(() => !!accessToken.value);
const links = computed(() =>
  authorized.value
    ? [
        { label: "CharacterDashboard.Nav", pathname: "/dashboard" },
        { label: "Links.SkillTree", pathname: "/skill-tree" },
      ]
    : [
        { label: "Emai.Nav.Tracks", pathname: "/#lernpfade" },
        { label: "Emai.Nav.Curriculum", pathname: "/#lehrplan" },
        { label: "Emai.Nav.Lab", pathname: "/#hardware" },
        { label: "Links.SkillTree", pathname: "/skill-tree" },
      ]
);
</script>

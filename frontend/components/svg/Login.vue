<!-- EmAI override of upstream components/svg/Login.vue (Bootstrap illustration). -->
<template>
  <div class="emai-auth-visual">
    <img src="/emai/g1-edu-hologram.webp" alt="" aria-hidden="true" />
  </div>
</template>

<style scoped>
.emai-auth-visual {
  display: grid;
  place-items: center;
  width: 100%;
  max-width: 28rem;
  aspect-ratio: 1;
  border: 1px solid var(--emai-line);
  border-radius: 6px;
  background: radial-gradient(55% 60% at 50% 55%, rgba(255, 103, 0, 0.14), transparent 70%), #171717;
}
.emai-auth-visual img {
  height: 92%;
  width: auto;
  object-fit: contain;
}
</style>

// EmAI tenant: Bootstrap-only features (MorphCoins shop, premium/subscription, hearts refill,
// challenges + leaderboard, webinars/calendar/coaching, commerce contract pages, dev pages)
// are pruned from the router in nuxt.config.ts. This middleware turns old deep links and
// in-app links that still point there into a redirect to the dashboard.
const HIDDEN =
  /^\/(morphcoins|subscription|webinars|calendar|coaching|orders|challenges|vertrag-|dev(\/|$)|profile\/challenges|docs\/right-of-withdrawal|docs\/terms-and-conditions-2026)/i;

export default defineNuxtRouteMiddleware((to) => {
  if (HIDDEN.test(to.path)) {
    return navigateTo("/dashboard", { replace: true });
  }
});

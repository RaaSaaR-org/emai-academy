// EmAI tenant: skills-ms GET /rooms falls back to the Bootstrap path "python-loops" when the
// client sends no ?path=, and the dashboard's "practice" button opens a bare /learn.
// Pin a bare /learn to the EmAI entry path (Decider + Builder root) instead.
export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== "/learn") return;
  const q = to.query;
  if (typeof q.path === "string" && q.path) return;
  if (typeof q.unit === "string" || typeof q.course === "string") return;
  const path = String(useRuntimeConfig().public.emaiDefaultLearningPath || "physical-ai-grundlagen");
  return navigateTo({ path: "/learn", query: { ...q, path } }, { replace: true });
});

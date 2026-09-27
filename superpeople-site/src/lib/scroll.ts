const behavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";

export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: behavior(), block: "start" });
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: behavior() });
  if (!window.location.hash) return;
  const clearHash = () => history.replaceState(null, "", window.location.pathname + window.location.search);
  window.addEventListener("scrollend", clearHash, { once: true });
  window.setTimeout(clearHash, 1200);
}

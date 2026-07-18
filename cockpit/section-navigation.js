const DEFAULT_SELECTOR = '.nav a[href^="#"], .hero a.button[href^="#"], .strategy-toc a[href^="#"], [data-section-route][href^="#"]';

export function revealSectionTarget(target) {
  let node = target;
  while (node && node !== document.documentElement) {
    if (node.matches?.("details")) node.open = true;
    if (node.hidden) node.hidden = false;
    if (node.getAttribute?.("aria-hidden") === "true") node.removeAttribute("aria-hidden");
    node = node.parentElement;
  }
  return target;
}

export function navigateToSection(target, { historyApi = globalThis.history, behavior } = {}) {
  if (!target?.id) return false;
  revealSectionTarget(target);
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const scrollBehavior = behavior || (reducedMotion ? "auto" : "smooth");
  try { historyApi?.replaceState?.(null, "", `#${encodeURIComponent(target.id)}`); } catch { /* ancre facultative */ }
  target.classList.add("section-route-focus");
  const temporaryTabindex = !target.hasAttribute("tabindex");
  if (temporaryTabindex) target.setAttribute("tabindex", "-1");
  try { target.focus({ preventScroll: true }); } catch { target.focus?.(); }
  requestAnimationFrame(() => target.scrollIntoView?.({ behavior: scrollBehavior, block: "start" }));
  setTimeout(() => {
    target.classList.remove("section-route-focus");
    if (temporaryTabindex) target.removeAttribute("tabindex");
  }, 1800);
  return true;
}

export function setupSectionNavigation({ root = document, selector = DEFAULT_SELECTOR } = {}) {
  const onClick = (event) => {
    const link = event.target.closest?.(selector);
    if (!link) return;
    const rawId = link.getAttribute("href")?.slice(1) || "";
    const target = root.getElementById?.(decodeURIComponent(rawId));
    if (!target) return;
    event.preventDefault();
    navigateToSection(target);
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}

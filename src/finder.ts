import type { Target, TargetSpec } from "./types";

/** Elements a text-only target can point at. Keeps "Subject" from matching a whole card. */
const POINTABLE =
  'a, button, label, input, select, textarea, summary, [role="button"], [role="tab"], [role="link"], [role="menuitem"], [data-dikhavu], h1, h2, h3, h4';

function norm(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
}

function labelsOf(el: Element): string[] {
  const input = el as HTMLInputElement;
  return [
    el.textContent,
    el.getAttribute("aria-label"),
    el.getAttribute("title"),
    el.getAttribute("placeholder"),
    el.getAttribute("data-dikhavu"),
    input.type === "submit" || input.type === "button" ? input.value : null,
  ].map(norm);
}

function matchSpec(spec: TargetSpec, root: ParentNode, requireVisible: boolean): Element | null {
  let candidates: Element[];
  try {
    candidates = Array.from(root.querySelectorAll(spec.selector ?? POINTABLE));
  } catch {
    return null; // invalid selector: treat as not found rather than crash the flow
  }
  if (requireVisible) candidates = candidates.filter(isVisible);

  if (spec.text) {
    const want = norm(spec.text);
    const scored = candidates
      .map((el) => {
        const labels = labelsOf(el);
        // Exact label beats "contains", and a tighter element beats a bigger wrapper.
        const exact = labels.some((l) => l === want);
        const contains = labels.some((l) => l.includes(want));
        return { el, rank: exact ? 0 : contains ? 1 : 2, size: norm(el.textContent).length };
      })
      .filter((c) => c.rank < 2)
      .sort((a, b) => a.rank - b.rank || a.size - b.size);
    candidates = scored.map((c) => c.el);
  }

  return candidates[spec.index ?? 0] ?? null;
}

function specs(target: Target): TargetSpec[] {
  const list = Array.isArray(target) ? target : [target];
  return list.map((t) => (typeof t === "string" ? { selector: t } : t));
}

/** Find the target right now, trying each fallback in order. */
export function findNow(target: Target, root: ParentNode = document, requireVisible = true): Element | null {
  for (const spec of specs(target)) {
    const el = matchSpec(spec, root, requireVisible);
    if (el) return el;
  }
  return null;
}

/** Wait for the target to appear (SPA pages render late). Resolves null on timeout or abort. */
export function waitFor(target: Target, timeoutMs: number, signal?: AbortSignal): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = findNow(target);
    if (found) return resolve(found);

    let done = false;
    const finish = (el: Element | null) => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearInterval(poll);
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(el);
    };
    const check = () => {
      const el = findNow(target);
      if (el) finish(el);
    };
    const onAbort = () => finish(null);

    // Mutations catch new nodes; the poll catches CSS-only changes (a panel sliding into view).
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    const poll = setInterval(check, 250);
    const timer = setTimeout(() => finish(null), timeoutMs);
    signal?.addEventListener("abort", onAbort);
  });
}

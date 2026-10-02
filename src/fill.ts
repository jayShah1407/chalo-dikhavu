import type { FieldInfo } from "./fields";

/**
 * Set values so frameworks notice. React tracks an input's value through the
 * prototype setter, so `el.value = x` alone is silently ignored; calling the
 * native setter and then firing `input` is what a real keystroke looks like.
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function fire(el: Element, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Type text visibly, a character at a time, so the user sees what goes in. */
async function typeText(el: HTMLInputElement | HTMLTextAreaElement, value: string, signal?: AbortSignal): Promise<void> {
  el.focus();
  // Keep it quick for long values: at most ~1.2s of typing.
  const perChar = Math.max(12, Math.min(55, 1200 / Math.max(1, value.length)));
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    setNativeValue(el, value);
    fire(el, "input");
  } else {
    for (let i = 1; i <= value.length; i++) {
      if (signal?.aborted) return;
      setNativeValue(el, value.slice(0, i));
      fire(el, "input");
      await wait(perChar);
    }
  }
  fire(el, "change");
  el.blur(); // run the site's own on-blur validation, like a person tabbing away
}

/** Put a parsed answer into the field described by `info`. */
export async function fillField(info: FieldInfo, value: string, signal?: AbortSignal): Promise<void> {
  const el = info.el;
  if (info.kind === "choice") {
    const option = info.options.find((o) => o.value === value);
    if (option?.el) {
      // Radio: click it, which is what custom radio components listen for.
      if (!option.el.checked) option.el.click();
      return;
    }
    const select = el as unknown as HTMLSelectElement;
    select.focus();
    setNativeValue(select, value);
    fire(select, "input");
    fire(select, "change");
    select.blur();
    return;
  }
  if (info.kind === "check") {
    const box = el as HTMLInputElement;
    if (box.checked !== (value === "yes")) box.click();
    return;
  }
  const input = el as HTMLInputElement;
  if (input.type === "date" || input.type === "number") {
    // These inputs reject partial values, so set them in one go.
    input.focus();
    setNativeValue(input, value);
    fire(input, "input");
    fire(input, "change");
    input.blur();
    return;
  }
  await typeText(input, value, signal);
}

/** Click as a user would, including the pointer events some components listen for. */
export function clickElement(el: Element): void {
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
  (el as HTMLElement).click();
}

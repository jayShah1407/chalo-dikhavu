/**
 * Understand a form field the way a person would: what it's called, what kind
 * of answer it wants, and whether it's too sensitive to ask for out loud.
 * This is what lets a developer write `{ form: "#signup" }` and nothing else.
 */

export type FieldKind =
  | "text"
  | "name"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "pan"
  | "pincode"
  | "choice"
  | "check"
  /** Types we can't fill from speech (time pickers, files, sliders): the user does it. */
  | "manual";

export interface FieldOption {
  label: string;
  value: string;
  /** The radio input, for radio groups. */
  el?: HTMLInputElement;
}

export interface FieldInfo {
  el: HTMLElement;
  /** What the cursor should point at (the visible label for hidden custom radios). */
  point: Element;
  kind: FieldKind;
  label: string;
  sensitive: boolean;
  required: boolean;
  options: FieldOption[];
  /** Date inputs want ISO; text boxes labelled "Date of birth" want dd/mm/yyyy. */
  isoDate: boolean;
}

const clean = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/\s+/g, " ")
    .replace(/\*/g, "")
    .replace(/\((optional|required)\)/gi, "")
    .replace(/[:：]\s*$/, "")
    .trim();

/** "full_name" / "fullName" → "full name" */
function humanize(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.[\]]+/g, " ")
    .trim()
    .toLowerCase();
}

/** Text of a label without the text of controls inside it (a <select>'s options, etc). */
function ownText(label: Element): string {
  const copy = label.cloneNode(true) as Element;
  copy.querySelectorAll("input, select, textarea, button, [aria-hidden='true']").forEach((n) => n.remove());
  return clean(copy.textContent);
}

function byId(id: string): Element | null {
  return document.getElementById(id);
}

export function labelOf(el: Element): string {
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = clean(labelledBy.split(/\s+/).map((id) => byId(id)?.textContent ?? "").join(" "));
    if (text) return text;
  }
  const aria = clean(el.getAttribute("aria-label"));
  if (aria) return aria;
  if (el.id) {
    const forLabel = el.ownerDocument.querySelector(`label[for="${el.id.replace(/["\\]/g, "\\$&")}"]`);
    if (forLabel && ownText(forLabel)) return ownText(forLabel);
  }
  const wrap = el.closest("label");
  if (wrap && ownText(wrap)) return ownText(wrap);
  const placeholder = clean(el.getAttribute("placeholder"));
  if (placeholder) return placeholder.replace(/(…|\.\.\.)$/, "").replace(/^(enter|type)\s+(your\s+)?/i, "");
  const title = clean(el.getAttribute("title"));
  if (title) return title;
  const name = el.getAttribute("name") || el.id;
  return name ? humanize(name) : "";
}

function groupLabel(radio: HTMLInputElement): string {
  const group = radio.closest("fieldset, [role='radiogroup']");
  if (group) {
    const legend = group.querySelector("legend");
    if (legend && clean(legend.textContent)) return clean(legend.textContent);
    const named = clean(group.getAttribute("aria-label"));
    if (named) return named;
    const by = group.getAttribute("aria-labelledby");
    if (by && byId(by)) return clean(byId(by)!.textContent);
  }
  return radio.name ? humanize(radio.name) : labelOf(radio);
}

function radiosOf(radio: HTMLInputElement): HTMLInputElement[] {
  if (!radio.name) return [radio];
  const scope = radio.form ?? radio.ownerDocument;
  return Array.from(scope.querySelectorAll<HTMLInputElement>(`input[type="radio"]`)).filter((r) => r.name === radio.name);
}

const SENSITIVE_AUTOCOMPLETE = new Set([
  "current-password", "new-password", "one-time-code", "cc-number", "cc-csc", "cc-exp", "cc-exp-month", "cc-exp-year",
]);
const SENSITIVE_HINT = /(password|passcode|pass code|\botp\b|one.?time|\bm?pin\b(?!\s*code)|\btpin\b|\bcvv\b|\bcvc\b|card\s*(number|no)|aadha?a?r|\bssn\b|security code)/i;
const MANUAL_TYPES = new Set(["datetime-local", "time", "month", "week", "file", "range", "color"]);

export function describeField(input: Element): FieldInfo {
  const el = input as HTMLInputElement;
  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute("type") ?? (tag === "input" ? "text" : tag)).toLowerCase();
  const autocomplete = (el.getAttribute("autocomplete") ?? "").toLowerCase();
  let label = labelOf(el);
  let point: Element = el;
  let options: FieldOption[] = [];
  let kind: FieldKind = "text";

  if (tag === "select") {
    kind = "choice";
    options = Array.from((el as unknown as HTMLSelectElement).options)
      .filter((o) => o.value !== "" && !o.disabled)
      .map((o) => ({ label: clean(o.textContent), value: o.value }));
  } else if (type === "radio") {
    kind = "choice";
    label = groupLabel(el);
    const radios = radiosOf(el);
    options = radios.map((r) => ({ label: labelOf(r), value: r.value, el: r }));
    point = el.closest("label") ?? el;
  } else if (type === "checkbox") {
    kind = "check";
    point = el.closest("label") ?? el;
  } else if (MANUAL_TYPES.has(type)) {
    kind = "manual";
  } else if (type === "email") kind = "email";
  else if (type === "tel") kind = "phone";
  else if (type === "number") kind = "number";
  else if (type === "date") kind = "date";

  const hints = `${el.name ?? ""} ${el.id} ${autocomplete} ${label}`.toLowerCase();
  // The browser's autocomplete hint is the most reliable signal, so it wins over
  // label words: "Full name (as on PAN card)" is a name, not a PAN.
  const AUTOCOMPLETE_KIND: Record<string, FieldKind> = {
    name: "name", "given-name": "name", "family-name": "name", "additional-name": "name",
    email: "email", tel: "phone", "tel-national": "phone", "postal-code": "pincode", bday: "date",
  };
  if (kind === "text" && AUTOCOMPLETE_KIND[autocomplete]) kind = AUTOCOMPLETE_KIND[autocomplete];
  else if (kind === "text") {
    if (/e-?mail/.test(hints)) kind = "email";
    else if (/(phone|mobile|\btel\b|contact no|whatsapp)/.test(hints)) kind = "phone";
    else if (/(pin\s*code|postal|\bzip\b)/.test(hints)) kind = "pincode";
    else if (/(full name|first name|last name|middle name|surname|father|spouse|mother)/.test(hints)) kind = "name";
    else if (/(\bpan\b|pan card|pan number|pan no)/.test(hints)) kind = "pan";
    else if (/(date of birth|\bdob\b|birth\s*date|bday)/.test(hints)) kind = "date";
    else if (/^(name|given-name|family-name|additional-name)$/.test(autocomplete) || /(full name|first name|last name|middle name|surname|\bname\b)/.test(hints)) {
      kind = "name";
    }
  }

  // Passwords, OTPs, PINs, card and Aadhaar numbers are never spoken aloud or heard.
  const sensitive =
    type === "password" ||
    SENSITIVE_AUTOCOMPLETE.has(autocomplete) ||
    (kind !== "pincode" && SENSITIVE_HINT.test(hints));

  return {
    el,
    point,
    kind,
    label: label || "this field",
    sensitive,
    required: el.required || el.getAttribute("aria-required") === "true",
    options,
    isoDate: type === "date",
  };
}

/** Is this a control Chalo Dikhavu can fill? */
function isField(el: Element): boolean {
  const input = el as HTMLInputElement;
  if (input.disabled || input.readOnly) return false;
  if (el.tagName === "INPUT") {
    const type = (el.getAttribute("type") ?? "text").toLowerCase();
    if (["hidden", "submit", "button", "reset", "image"].includes(type)) return false;
  }
  return true;
}

function looksVisible(el: Element): boolean {
  // Custom radios often hide the real input and style its label instead.
  const shown = el.closest("label") ?? el;
  const r = shown.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const s = getComputedStyle(shown);
  return s.visibility !== "hidden" && s.display !== "none";
}

/** Every fillable field in a form, in page order; one entry per radio group. */
export function collectFields(form: ParentNode, requireVisible = true): HTMLElement[] {
  const seenGroups = new Set<string>();
  return Array.from(form.querySelectorAll<HTMLElement>("input, select, textarea")).filter((el) => {
    if (!isField(el) || (requireVisible && !looksVisible(el))) return false;
    const input = el as HTMLInputElement;
    if (input.type === "radio" && input.name) {
      if (seenGroups.has(input.name)) return false;
      seenGroups.add(input.name);
    }
    return true;
  });
}

export function submitButtonOf(form: Element): HTMLElement | null {
  return form.querySelector<HTMLElement>('button[type="submit"], input[type="submit"], button:not([type])');
}

export function isSubmitButton(el: Element): boolean {
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  if (el.tagName === "INPUT") return type === "submit";
  return el.tagName === "BUTTON" && (type === "submit" || (!type && !!(el as HTMLButtonElement).form));
}

/** A stable selector for an element, so a step can re-find it after React re-renders. */
export function selectorFor(el: Element): string {
  if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `#${el.id}`;
  const name = el.getAttribute("name");
  const tag = el.tagName.toLowerCase();
  if (name) {
    const type = el.getAttribute("type");
    const same = el.ownerDocument.querySelectorAll(`${tag}[name="${name}"]`);
    if (same.length === 1 || type === "radio") return `${tag}[name="${name}"]`;
  }
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.tagName !== "BODY" && parts.length < 8) {
    if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
      parts.unshift(`#${node.id}`);
      break;
    }
    const parent: Element | null = node.parentElement;
    const index = parent ? Array.from(parent.children).filter((c) => c.tagName === node!.tagName).indexOf(node) + 1 : 1;
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${index})`);
    node = parent;
  }
  return parts.join(" > ");
}


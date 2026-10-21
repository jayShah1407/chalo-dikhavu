/**
 * Text that can be given once, or per language code:
 *   "Click here"  |  { en: "Click here", hi: "यहाँ क्लिक करें" }
 */
export type LocalizedText = string | Record<string, string>;

/**
 * How to find an element on the page. A plain string is a CSS selector.
 * Give an array to list fallbacks: the first one that matches wins, so a
 * flow survives a renamed class or a moved button.
 */
export type Target = string | TargetSpec | Array<string | TargetSpec>;

export interface TargetSpec {
  /** CSS selector. Combined with `text`, it narrows which elements are checked. */
  selector?: string;
  /** Visible text, aria-label, placeholder or title the element should contain. */
  text?: string;
  /** Pick the nth match (0-based) when several elements qualify. */
  index?: number;
}

export type Advance =
  /** Wait for the user to click the highlighted element (default when a target is set). */
  | "click"
  /** Show a Next button (default when there is no target). */
  | "next"
  /** Wait for the user to type or change a value in the highlighted field. */
  | "input"
  /** Move on by itself after `delay` ms. */
  | "auto";

export interface Step extends FieldOptions {
  /** Element to point at. Omit for a centered message. */
  target?: Target;
  /**
   * Page this step lives on, e.g. "/student/teachers" or "/student/teachers/:id".
   * If the user is elsewhere, Chalo Dikhavu navigates there (static paths) or waits
   * for them to arrive (paths with :params).
   */
  path?: string;
  /**
   * What the guide says and shows in the bubble. Optional for `action` and
   * `form` steps: Chalo Dikhavu writes it from the field's label ("Enter your email here").
   */
  say?: LocalizedText;
  /** Pre-recorded audio URL(s). Falls back to text-to-speech when missing. */
  audio?: LocalizedText;
  advance?: Advance;
  /** ms before moving on, for `advance: "auto"`. Default 2500. */
  delay?: number;
  /** ms to wait for the target to appear. Default 8000. */
  timeout?: number;

  /**
   * In "do it with me" mode, Chalo Dikhavu performs this on the target instead of
   * waiting for the user: "click" it, or "fill" it (text, select, radio or
   * checkbox; the question is generated from the field unless `ask` is given).
   * In "just show me" mode the step is shown like any other.
   */
  action?: "click" | "fill";
  /**
   * A whole form: Chalo Dikhavu finds every field in it, in order, asks for each value
   * and fills it, then points at the submit button. Per-field tweaks go in `fields`.
   */
  form?: Target;
  /** Per-field overrides for a `form` step, keyed by CSS selector. */
  fields?: Record<string, FieldOptions>;
  /**
   * Who presses a clicked button in "do" mode. Submit buttons default to
   * "user" so an account, payment or transfer is never submitted for them.
   */
  confirm?: "user" | "auto";
}

/** Tweaks for a field in "do it with me" mode. Also valid directly on a `fill` step. */
export interface FieldOptions {
  /** Question to ask instead of the generated one. */
  ask?: LocalizedText;
  /** Fill this value without asking. */
  value?: string;
  /**
   * Never listen to or fill this field; the user types it. Detected
   * automatically for passwords, OTPs, PINs, CVV, card and Aadhaar numbers.
   */
  sensitive?: boolean;
  /** Offer a Skip button. Default: true unless the field is `required`. */
  optional?: boolean;
  /** Leave this field out of a `form` step. */
  skip?: boolean;
  /**
   * Your own answer to "why is this needed?" for this field. Shown and spoken
   * as-is, with no AI call, so it's free, instant and exactly your wording.
   */
  why?: LocalizedText;
}

export interface Flow {
  id: string;
  title: LocalizedText;
  /** Phrases users might say or type to ask for this flow, any language. */
  keywords?: string[] | Record<string, string[]>;
  steps: Step[];
  /**
   * Background the AI may use to answer questions during this flow: what the
   * process is for, why each document is needed, your policies. Plain text.
   */
  knowledge?: LocalizedText;
}

export type RunMode =
  /** Point at each thing and let the user do it. */
  | "show"
  /** Ask the user for values and click/fill on their behalf. */
  | "do";

export type ChaloDikhavuEvent =
  | { type: "flow:start"; flowId: string; mode: RunMode }
  | { type: "flow:end"; flowId: string; completed: boolean }
  | { type: "step:show"; flowId: string; index: number }
  | { type: "step:missing"; flowId: string; index: number }
  | { type: "ask"; query: string; matchedFlowId: string | null }
  /** A field was filled in "do" mode. The value itself is never included. */
  | { type: "field:filled"; flowId: string; label: string; by: "voice" | "typed" | "preset" }
  /** The user was asked to fill a field themselves (sensitive or unsupported). */
  | { type: "field:manual"; flowId: string; label: string }
  /** A question was answered: from a field's `why`, or by the AI. */
  | { type: "explain"; flowId: string | null; field: string | null; source: "why" | "ai" | "error" };

/**
 * What the SDK sends to your AI endpoint. It describes the page and the field,
 * never what the user has typed into the form.
 */
export interface ExplainRequest {
  question: string;
  /** Language to answer in, e.g. "hi". */
  lang: string;
  page: { title: string; path: string };
  flow: { id: string; title: string } | null;
  /** Your site-wide `knowledge` plus the current flow's, as plain text. */
  knowledge: string;
  /** The field the user is on, if any. Labels only. */
  field: { label: string; kind: string; required: boolean } | null;
  /** Labels of the other fields in the form, for context. */
  formFields: string[];
}

export interface AiOptions {
  /**
   * POST endpoint that takes an ExplainRequest and returns `{ answer }`.
   * Either your own server (see `chalo-dikhavu/server`) or Chalo Dikhavu Cloud.
   */
  endpoint?: string;
  /** Chalo Dikhavu Cloud project key (public, origin-restricted). Sent as a Bearer token. */
  projectKey?: string;
  /** Or answer in code instead of over HTTP. Takes precedence over `endpoint`. */
  answer?: (req: ExplainRequest) => Promise<string>;
}

export interface ChaloDikhavuOptions {
  flows: Flow[];
  /** Starting language code. Default "en". */
  language?: string;
  /** Languages offered in the language switcher. Default: just `language`. */
  languages?: string[];
  /**
   * Key to hold for voice questions, as KeyboardEvent.key (" " is Space).
   * Default " ". Pass false to disable push-to-talk.
   */
  hotkey?: string | false;
  /** ms the hotkey must be held before the mic opens. Default 350. */
  holdMs?: number;
  /** Show the floating help button. Default true. */
  launcher?: boolean;
  /** Speak step text with browser text-to-speech when a step has no audio. Default true. */
  tts?: boolean;
  /** Accent color for cursor, spotlight and buttons. Default "#4f46e5". */
  color?: string;
  /**
   * Navigate to a static path. Default: click a matching <a href> if one is
   * on the page (keeps SPA routing), else full page load. Pass your router's
   * push for the smoothest result, e.g. (p) => router.push(p).
   */
  navigate?: (path: string) => void;
  onEvent?: (event: ChaloDikhavuEvent) => void;
  /**
   * Answer users' questions ("what is KYC for?", "why do you need my PAN?")
   * with an AI model. Without it, only fields' own `why` text is used.
   */
  ai?: AiOptions;
  /** Site-wide background for the AI (who you are, support contacts, policies). */
  knowledge?: LocalizedText;
  /**
   * Listening timings for spoken answers. `waitMs`: how long to wait for the
   * user to start speaking (default 8000). `silenceMs`: how long a pause ends
   * their answer (default 1800; raise it for users who speak slowly).
   */
  speech?: { waitMs?: number; silenceMs?: number };
}

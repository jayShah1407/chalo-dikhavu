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

export interface Step {
  /** Element to point at. Omit for a centered message. */
  target?: Target;
  /**
   * Page this step lives on, e.g. "/student/teachers" or "/student/teachers/:id".
   * If the user is elsewhere, Raahi navigates there (static paths) or waits
   * for them to arrive (paths with :params).
   */
  path?: string;
  /** What the guide says and shows in the bubble. */
  say: LocalizedText;
  /** Pre-recorded audio URL(s). Falls back to text-to-speech when missing. */
  audio?: LocalizedText;
  advance?: Advance;
  /** ms before moving on, for `advance: "auto"`. Default 2500. */
  delay?: number;
  /** ms to wait for the target to appear. Default 8000. */
  timeout?: number;
}

export interface Flow {
  id: string;
  title: LocalizedText;
  /** Phrases users might say or type to ask for this flow, any language. */
  keywords?: string[] | Record<string, string[]>;
  steps: Step[];
}

export type RaahiEvent =
  | { type: "flow:start"; flowId: string }
  | { type: "flow:end"; flowId: string; completed: boolean }
  | { type: "step:show"; flowId: string; index: number }
  | { type: "step:missing"; flowId: string; index: number }
  | { type: "ask"; query: string; matchedFlowId: string | null };

export interface RaahiOptions {
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
  onEvent?: (event: RaahiEvent) => void;
}

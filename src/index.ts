import { ChaloDikhavu } from "./engine";
import type { ChaloDikhavuOptions } from "./types";

export { ChaloDikhavu };
export { rankFlows, resolve } from "./intent";
export { findNow, waitFor } from "./finder";
export { matchPath } from "./paths";
export { describeField, collectFields } from "./fields";
export { questionFor } from "./prompts";
export { parseAnswer } from "./answers";
export type {
  Advance,
  AiOptions,
  ExplainRequest,
  FieldOptions,
  Flow,
  LocalizedText,
  ChaloDikhavuEvent,
  ChaloDikhavuOptions,
  RunMode,
  Step,
  Target,
  TargetSpec,
} from "./types";

/** Create and mount a guide in one call: `const guide = init({ flows })`. */
export function init(options: ChaloDikhavuOptions): ChaloDikhavu {
  return new ChaloDikhavu(options).mount();
}

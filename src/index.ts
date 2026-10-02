import { Raahi } from "./raahi";
import type { RaahiOptions } from "./types";

export { Raahi };
export { rankFlows, resolve } from "./intent";
export { findNow, waitFor } from "./finder";
export { matchPath } from "./paths";
export { describeField, collectFields } from "./fields";
export { questionFor } from "./prompts";
export { parseAnswer } from "./answers";
export type {
  Advance,
  FieldOptions,
  Flow,
  LocalizedText,
  RaahiEvent,
  RaahiOptions,
  RunMode,
  Step,
  Target,
  TargetSpec,
} from "./types";

/** Create and mount a guide in one call: `const guide = init({ flows })`. */
export function init(options: RaahiOptions): Raahi {
  return new Raahi(options).mount();
}

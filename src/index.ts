import { Raahi } from "./raahi";
import type { RaahiOptions } from "./types";

export { Raahi };
export { rankFlows, resolve } from "./intent";
export { findNow, waitFor } from "./finder";
export { matchPath } from "./paths";
export type {
  Advance,
  Flow,
  LocalizedText,
  RaahiEvent,
  RaahiOptions,
  Step,
  Target,
  TargetSpec,
} from "./types";

/** Create and mount a guide in one call: `const guide = init({ flows })`. */
export function init(options: RaahiOptions): Raahi {
  return new Raahi(options).mount();
}

// SFX module — procedural sound effects system

export { SFXPresetSchema } from "./types.ts";
export type { SFXPreset } from "./types.ts";

export { renderSFX } from "./renderer.ts";

export { SFXManager } from "./SFXManager.ts";
export type { SFXManagerConfig } from "./SFXManager.ts";

export { SFX_PRESETS } from "./presets.ts";
export {
  footstep,
  zoneTransition,
  dialogueOpen,
  dialogueClose,
  save,
  alert,
  menuSelect,
} from "./presets.ts";

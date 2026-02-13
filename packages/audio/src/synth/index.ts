// Barrel export for synth module

export { square, triangle, sawtooth, noise, createLFSRState } from "./oscillators.ts";
export type { LFSRState } from "./oscillators.ts";

export { encodeWav, parseWavHeader } from "./wav-encoder.ts";
export type { WavHeader } from "./wav-encoder.ts";

export { Sequencer } from "./Sequencer.ts";
export type { SequencerConfig } from "./Sequencer.ts";

export { ChiptuneEngine } from "./ChiptuneEngine.ts";
export type { ChiptuneEngineConfig } from "./ChiptuneEngine.ts";

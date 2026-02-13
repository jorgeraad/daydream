// WAV file encoder -- produces 16-bit mono PCM at a given sample rate
// Outputs a complete WAV file as a Uint8Array ready for playback

/**
 * Write an ASCII string into a Uint8Array at the given offset.
 */
function writeString(buffer: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    buffer[offset + i] = str.charCodeAt(i);
  }
}

/**
 * Encode PCM float samples into a valid WAV file.
 *
 * Produces a 16-bit mono PCM WAV at the specified sample rate.
 * Float samples are clamped to [-1, 1] before conversion to int16.
 *
 * @param samples - Float32Array of PCM samples in [-1, 1]
 * @param sampleRate - Sample rate in Hz (typically 44100)
 * @returns Complete WAV file as Uint8Array
 */
export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
): Uint8Array {
  const numChannels = 1; // mono
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const buffer = new Uint8Array(headerSize + dataSize);
  const view = new DataView(buffer.buffer);

  // RIFF header
  writeString(buffer, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); // file size - 8
  writeString(buffer, 8, "WAVE");

  // fmt chunk
  writeString(buffer, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size (PCM = 16)
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate * numChannels * bytesPerSample,
    true,
  ); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(buffer, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write samples as 16-bit signed integers
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(headerSize + i * 2, Math.round(clamped * 32767), true);
  }

  return buffer;
}

/**
 * Parse a WAV header from a Uint8Array buffer.
 * Useful for testing/validation.
 */
export interface WavHeader {
  riffTag: string;
  fileSize: number;
  waveTag: string;
  fmtTag: string;
  fmtChunkSize: number;
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  dataTag: string;
  dataSize: number;
}

/**
 * Read and validate WAV header fields from a buffer.
 */
export function parseWavHeader(buffer: Uint8Array): WavHeader {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const decoder = new TextDecoder("utf-8");

  return {
    riffTag: decoder.decode(buffer.slice(0, 4)),
    fileSize: view.getUint32(4, true),
    waveTag: decoder.decode(buffer.slice(8, 12)),
    fmtTag: decoder.decode(buffer.slice(12, 16)),
    fmtChunkSize: view.getUint32(16, true),
    audioFormat: view.getUint16(20, true),
    numChannels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    dataTag: decoder.decode(buffer.slice(36, 40)),
    dataSize: view.getUint32(40, true),
  };
}

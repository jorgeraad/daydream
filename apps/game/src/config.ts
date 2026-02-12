import { homedir } from "node:os";
import { join } from "node:path";

export const SAVE_DIR = join(homedir(), ".daydream", "worlds");
export const AUTO_SAVE_INTERVAL_MS = 60_000;

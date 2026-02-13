// Zone configuration — centralized tunable parameters for multi-zone world.
// All components receive relevant values from this config rather than using
// hardcoded numbers. Created once at game startup and threaded through.

export interface ZoneConfig {
  /** Width of each zone in tiles. Default: 80 */
  zoneWidth: number;
  /** Height of each zone in tiles. Default: 40 */
  zoneHeight: number;
  /** Manhattan distance — zones within this radius stay in memory. Default: 2 */
  keepRadius: number;
  /** Maximum concurrent AI generation calls. Default: 4 */
  maxConcurrentGenerations: number;
  /** Number of tile rows/columns to blend at zone boundaries. Default: 3 */
  edgeBlendDepth: number;
  /** Fade-out duration in ms during zone transition. Default: 300 */
  transitionFadeOutMs: number;
  /** Fade-in duration in ms during zone transition. Default: 200 */
  transitionFadeInMs: number;
}

export const DEFAULT_ZONE_CONFIG: ZoneConfig = {
  zoneWidth: 80,
  zoneHeight: 40,
  keepRadius: 2,
  maxConcurrentGenerations: 4,
  edgeBlendDepth: 3,
  transitionFadeOutMs: 300,
  transitionFadeInMs: 200,
};

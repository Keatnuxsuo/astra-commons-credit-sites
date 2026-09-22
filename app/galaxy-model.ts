export type JourneyStage = 'arrival' | 'sky' | 'rewards';
export const CORE = [-.3, -1.22, 0] as const;

/** Seeded geometry preserves the same Astra constellation on every visit. */
export function randomSequence(seed = 6019) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function artworkScale(width: number, height: number, distance: number, stage: JourneyStage) {
  const worldHeight = 2 * distance * Math.tan(Math.PI * 42 / 360);
  const targetHeight = stage === 'sky' ? width > 760 ? height * .73 : Math.max(300, height - 345)
    : width <= 760 ? Math.max(240, height - 470) : height * .79;
  return Math.min(targetHeight / 9.4, width * .91 / 8.7) / height * worldHeight;
}

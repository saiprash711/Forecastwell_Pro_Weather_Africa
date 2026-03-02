import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// ── Brand palette ──────────────────────────────────────────────────────────────
export const COLORS = {
  navy: "#0A0E1A",
  navyLight: "#131929",
  navyCard: "#1A2235",
  navyBorder: "#1E2D45",
  blue: "#2563EB",
  blueLight: "#3B82F6",
  blueSoft: "#1E3A5F",
  amber: "#F59E0B",
  amberLight: "#FCD34D",
  emerald: "#10B981",
  emeraldLight: "#34D399",
  rose: "#F43F5E",
  roseLight: "#FB7185",
  white: "#F8FAFC",
  muted: "#94A3B8",
  dimmed: "#475569",
} as const;

// ── Spring configs ─────────────────────────────────────────────────────────────
export const SPRING_CONFIGS = {
  smooth: { damping: 20, stiffness: 120, mass: 1 },
  snappy: { damping: 14, stiffness: 200, mass: 0.8 },
  gentle: { damping: 30, stiffness: 80, mass: 1 },
  bouncy: { damping: 10, stiffness: 180, mass: 0.7 },
} as const;

/** A spring that starts at `delay` frames and resolves by ~`delay + 30` frames */
export function useEntrySpring(delay: number = 0, config = SPRING_CONFIGS.smooth) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
}

/** Fade from 0→1 starting at `from` frame, completing at `to` frame */
export function useFade(from: number, to: number) {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

/** Slide-up: translates from `offset`px → 0px, starting at `delay` frames */
export function useSlideUp(delay: number = 0, offset: number = 60, config = SPRING_CONFIGS.smooth) {
  const progress = useEntrySpring(delay, config);
  return interpolate(progress, [0, 1], [offset, 0]);
}

/** Scale from 0.8 → 1 with a spring */
export function useScaleIn(delay: number = 0, from: number = 0.85, config = SPRING_CONFIGS.snappy) {
  const progress = useEntrySpring(delay, config);
  return interpolate(progress, [0, 1], [from, 1]);
}

/** Wipe opacity exit: start fading out at `startAt`, fully gone at `endAt` */
export function useExitFade(startAt: number, duration: number = 15) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startAt, startAt + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Returns 0..1 progress of a counter that ticks every frame */
export function useCountUp(target: number, startFrame: number, endFrame: number): number {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.round(progress * target);
}

/** Animated stroke-dashoffset for SVG path reveals */
export function usePathReveal(
  totalLength: number,
  startFrame: number,
  endFrame: number
): number {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return totalLength * (1 - progress);
}

/** Stagger helper: given item index and stagger gap (frames), returns delay */
export function staggerDelay(index: number, gapFrames: number = 8): number {
  return index * gapFrames;
}

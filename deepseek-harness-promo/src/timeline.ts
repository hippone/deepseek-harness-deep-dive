export const FPS = 30;

export const timeline = {
  hook: {from: 0, duration: 180},          // 6.0s (Phase 1: 3.5s, Phase 2: 2.5s)
  source: {from: 180, duration: 240},      // 8.0s (Code reveal & read)
  architecture: {from: 420, duration: 360},// 12.0s (Pipeline step by step)
  chapters: {from: 780, duration: 210},    // 7.0s (4 Pillars)
  message: {from: 990, duration: 180},     // 6.0s (Core Epigram)
  website: {from: 1170, duration: 180},    // 6.0s (Website & CTA)
} as const;

export const TOTAL_FRAMES = 1350; // 45.0s Total


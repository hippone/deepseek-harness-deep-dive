export const theme = {
  // Backgrounds
  background: "#07080B",
  backgroundGradient: "radial-gradient(ellipse 80% 80% at 50% -20%, rgba(30, 58, 138, 0.25), rgba(7, 8, 11, 1))",
  surface: "rgba(16, 20, 28, 0.75)",
  surfaceElevated: "rgba(23, 29, 42, 0.85)",
  surfaceGlass: "rgba(255, 255, 255, 0.03)",

  // Brand & Accents
  accent: "#3B82F6",
  accentLight: "#60A5FA",
  accentGlow: "rgba(59, 130, 246, 0.5)",
  accentCyan: "#06B6D4",
  accentEmerald: "#10B981",
  accentAmber: "#F59E0B",
  accentPurple: "#8B5CF6",

  // Typography
  text: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.86)",
  muted: "rgba(255, 255, 255, 0.55)",
  faint: "rgba(255, 255, 255, 0.28)",

  // Borders & Glows
  line: "rgba(255, 255, 255, 0.08)",
  lineStrong: "rgba(255, 255, 255, 0.16)",
  lineGlow: "rgba(96, 165, 250, 0.35)",
  borderGradient: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 100%)",

  // Shadows
  shadowSubtle: "0 10px 30px -10px rgba(0,0,0,0.5)",
  shadowGlass: "0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)",
  shadowGlow: "0 0 50px rgba(59, 130, 246, 0.25)",

  // Safe area & Layout
  safeX: 80,
  safeTop: 230,
  safeBottom: 380,
  radius: 28,
  radiusSm: 16,
  radiusLg: 36,

  // Fonts
  fontSans:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Segoe UI", sans-serif',
  fontDisplay:
    '"SF Pro Display", -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
  fontMono:
    '"JetBrains Mono", "SF Mono", "Fira Code", Menlo, Monaco, Consolas, monospace',
} as const;


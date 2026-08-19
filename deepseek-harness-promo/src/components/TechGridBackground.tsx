import {AbsoluteFill, interpolate, useCurrentFrame} from "remotion";
import {theme} from "../theme";

export const TechGridBackground: React.FC<{accentColor?: string}> = ({
  accentColor = theme.accent,
}) => {
  const frame = useCurrentFrame();

  // Gentle breathing glow effects
  const glow1Y = interpolate(frame, [0, 480, 960], [-100, 300, -100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glow2Y = interpolate(frame, [0, 480, 960], [1200, 700, 1200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pulse = Math.sin(frame / 20) * 0.05 + 0.95;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* 1. Dynamic Mesh Ambient Glows */}
      <div
        style={{
          position: "absolute",
          left: -150,
          top: glow1Y,
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}28 0%, rgba(6,182,212,0.12) 40%, transparent 70%)`,
          filter: "blur(90px)",
          transform: `scale(${pulse})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -150,
          top: glow2Y,
          width: 750,
          height: 750,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, rgba(59,130,246,0.1) 45%, transparent 70%)",
          filter: "blur(100px)",
          transform: `scale(${1.05 - pulse * 0.05})`,
        }}
      />

      {/* 2. Cyber Matrix Grid SVG overlay */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.22,
        }}
      >
        <defs>
          <pattern
            id="grid-dots"
            x="0"
            y="0"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="30" cy="30" r="1.5" fill="#60A5FA" />
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-dots)" />
      </svg>

      {/* 3. Top Vignette & Bottom Fade */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, transparent 40%, rgba(7,8,11,0.7) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

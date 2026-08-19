import {interpolate, useCurrentFrame} from "remotion";
import {theme} from "../theme";

type GlowBadgeProps = {
  text: string;
  variant?: "accent" | "cyan" | "emerald" | "purple" | "neutral";
  size?: "sm" | "md" | "lg";
  hasDot?: boolean;
};

const variants = {
  accent: {
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(96, 165, 250, 0.4)",
    text: "#93C5FD",
    dot: "#60A5FA",
    glow: "rgba(59, 130, 246, 0.35)",
  },
  cyan: {
    bg: "rgba(6, 182, 212, 0.12)",
    border: "rgba(34, 211, 238, 0.4)",
    text: "#67E8F9",
    dot: "#22D3EE",
    glow: "rgba(6, 182, 212, 0.35)",
  },
  emerald: {
    bg: "rgba(16, 185, 129, 0.12)",
    border: "rgba(52, 211, 153, 0.4)",
    text: "#6EE7B7",
    dot: "#34D399",
    glow: "rgba(16, 185, 129, 0.35)",
  },
  purple: {
    bg: "rgba(139, 92, 246, 0.12)",
    border: "rgba(167, 139, 250, 0.4)",
    text: "#C4B5FD",
    dot: "#A78BFA",
    glow: "rgba(139, 92, 246, 0.35)",
  },
  neutral: {
    bg: "rgba(255, 255, 255, 0.06)",
    border: "rgba(255, 255, 255, 0.16)",
    text: theme.textSecondary,
    dot: "#94A3B8",
    glow: "rgba(255, 255, 255, 0.1)",
  },
};

export const GlowBadge: React.FC<GlowBadgeProps> = ({
  text,
  variant = "accent",
  size = "md",
  hasDot = true,
}) => {
  const frame = useCurrentFrame();
  const v = variants[variant];

  const dotPulse = interpolate(
    Math.sin(frame / 6),
    [-1, 1],
    [0.4, 1]
  );

  const paddingMap = {
    sm: "6px 14px",
    md: "10px 20px",
    lg: "14px 28px",
  };

  const fontMap = {
    sm: `500 18px ${theme.fontMono}`,
    md: `600 24px ${theme.fontMono}`,
    lg: `700 28px ${theme.fontMono}`,
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: paddingMap[size],
        borderRadius: 100,
        background: v.bg,
        border: `1px solid ${v.border}`,
        boxShadow: `0 0 20px ${v.glow}, inset 0 1px 0 rgba(255,255,255,0.15)`,
        backdropFilter: "blur(12px)",
      }}
    >
      {hasDot && (
        <span
          style={{
            width: size === "sm" ? 8 : 10,
            height: size === "sm" ? 8 : 10,
            borderRadius: "50%",
            background: v.dot,
            boxShadow: `0 0 10px ${v.dot}`,
            opacity: dotPulse,
          }}
        />
      )}
      <span
        style={{
          font: fontMap[size],
          color: v.text,
          letterSpacing: 1.5,
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
    </div>
  );
};

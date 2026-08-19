import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {GlowBadge} from "../components/GlowBadge";
import {theme} from "../theme";

export const CoreMessageScene: React.FC<{accentColor?: string}> = ({
  accentColor = theme.accent,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const phrase1Reveal = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const phrase2Spring = spring({
    frame: frame - 30,
    fps,
    config: {damping: 18, stiffness: 110},
  });

  const phrase3Spring = spring({
    frame: frame - 70,
    fps,
    config: {damping: 18, stiffness: 120},
  });

  return (
    <AbsoluteFill
      style={{
        padding: `${theme.safeTop}px ${theme.safeX}px ${theme.safeBottom}px`,
        color: theme.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      {/* 1. Intro tag */}
      <div
        style={{
          opacity: phrase1Reveal,
          transform: `translateY(${(1 - phrase1Reveal) * 20}px)`,
        }}
      >
        <GlowBadge text="04 • ARCHITECTURAL CRITERIA" variant="cyan" size="md" />
      </div>

      {/* 2. Main Epigram Phrase */}
      <div
        style={{
          marginTop: 48,
          font: `700 72px/1.22 ${theme.fontSans}`,
          letterSpacing: -1.5,
          opacity: interpolate(frame, [30, 50], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `scale(${phrase2Spring})`,
          transformOrigin: "left center",
        }}
      >
        评估一个 Agent 架构
        <br />
        <span style={{color: theme.muted}}>不是看它单次回答多惊艳</span>
      </div>

      {/* 3. Punchline */}
      <div
        style={{
          marginTop: 48,
          padding: "36px 40px",
          borderRadius: theme.radius,
          background: "rgba(16, 20, 28, 0.92)",
          border: `1.5px solid ${theme.accentLight}`,
          boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 50px ${accentColor}30, inset 0 1px 0 rgba(255,255,255,0.15)`,
          opacity: interpolate(frame, [70, 90], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `scale(${phrase3Spring})`,
          transformOrigin: "left center",
          width: "100%",
        }}
      >
        <div style={{font: `600 30px ${theme.fontSans}`, color: theme.accentCyan}}>
          而是看它能否在生产中经得起
        </div>
        <div
          style={{
            marginTop: 14,
            font: `800 68px/1.2 ${theme.fontSans}`,
            color: "#FFFFFF",
            letterSpacing: -0.5,
          }}
        >
          能力替换 • 崩溃恢复 • 安全审计
        </div>
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            font: `500 24px ${theme.fontMono}`,
            color: theme.muted,
          }}
        >
          <span>🎯 何时值得采用</span>
          <span>•</span>
          <span>🛑 何时应当暂缓</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};


import {AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {BrowserReveal} from "../components/BrowserReveal";
import {GlowBadge} from "../components/GlowBadge";
import {copy} from "../data/copy";
import {theme} from "../theme";

export const WebsiteRevealScene: React.FC<{accentColor?: string}> = ({
  accentColor = theme.accent,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const browserProgress = interpolate(frame, [0, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const cardSpring = spring({
    frame: frame - 35,
    fps,
    config: {damping: 18, stiffness: 110},
  });

  return (
    <AbsoluteFill
      style={{
        padding: `${theme.safeTop - 30}px ${theme.safeX}px ${theme.safeBottom - 30}px`,
        color: theme.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* 1. Header Badge */}
      <div
        style={{
          opacity: interpolate(frame, [0, 12], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
        }}
      >
        <GlowBadge text="OPEN SOURCE TECHNICAL HANDBOOK" variant="accent" size="sm" />
      </div>

      {/* 2. 3D Browser Window Showcase */}
      <div
        style={{
          opacity: interpolate(frame, [4, 18], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
          transform: `scale(${0.96 + browserProgress * 0.04})`,
        }}
      >
        <BrowserReveal progress={browserProgress} accentColor={accentColor} />
      </div>

      {/* 3. Bottom Action & Information Card */}
      <div
        style={{
          width: "100%",
          padding: "32px 36px",
          borderRadius: theme.radius,
          border: `1.5px solid ${theme.lineStrong}`,
          background: "rgba(16, 20, 28, 0.95)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 25px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.12)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${cardSpring})`,
          opacity: interpolate(frame, [25, 38], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {/* Title row */}
        <div style={{display: "flex", alignItems: "center", gap: 16}}>
          <Img src={staticFile("site/deepseek-logo.svg")} style={{width: 52, height: 52}} />
          <div style={{font: `700 40px ${theme.fontSans}`, letterSpacing: -0.5}}>
            {copy.mainTitle}
          </div>
        </div>

        <div style={{marginTop: 10, font: `400 24px ${theme.fontSans}`, color: theme.muted, textAlign: "center"}}>
          {copy.subtitle}
        </div>

        {/* CTA Button */}
        <div
          style={{
            marginTop: 24,
            padding: "16px 44px",
            borderRadius: 100,
            background: `linear-gradient(135deg, ${theme.accentLight} 0%, ${theme.accent} 100%)`,
            color: "#FFFFFF",
            font: `700 30px ${theme.fontSans}`,
            boxShadow: `0 0 35px ${accentColor}80, 0 10px 25px rgba(0,0,0,0.5)`,
            letterSpacing: 1,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>立即在线阅读</span>
          <span>→</span>
        </div>

        <div style={{marginTop: 16, font: `400 20px ${theme.fontSans}`, color: theme.faint}}>
          {copy.disclaimer}
        </div>
      </div>
    </AbsoluteFill>
  );
};


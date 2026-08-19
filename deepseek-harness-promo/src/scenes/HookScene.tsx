import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {GlowBadge} from "../components/GlowBadge";
import {HolographicCore3D} from "../components/HolographicCore3D";
import {copy} from "../data/copy";
import {theme} from "../theme";

const agentCapabilities = [
  {label: "📥 接收并理解任务", angle: 30, r: 360},
  {label: "🧠 规划决策下一步", angle: 90, r: 380},
  {label: "⚡ 调用工具去执行", angle: 150, r: 360},
  {label: "💾 记住已完成进度", angle: 210, r: 360},
  {label: "🛡️ 权限与边界管控", angle: 270, r: 380},
  {label: "🔄 验证结果并自省", angle: 330, r: 360},
] as const;

export const HookScene: React.FC<{accentColor?: string}> = ({
  accentColor = theme.accent,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Phase 1: Capabilities & Question (Frame 0 - 105, 3.5s)
  // Phase 2: Big Impact HARNESS Reveal (Frame 105 - 180, 2.5s)

  const isImpactPhase = frame >= 105;

  const hookReveal = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const questionOpacity = interpolate(frame, [25, 45, 95, 105], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const questionY = interpolate(frame, [25, 45], [25, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Impact scale & spring (gentle and grand)
  const impactSpring = spring({
    frame: frame - 105,
    fps,
    config: {damping: 18, stiffness: 120, mass: 0.8},
  });

  const impactGlow = interpolate(frame, [105, 125, 180], [0, 1, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        padding: `${theme.safeTop}px ${theme.safeX}px ${theme.safeBottom}px`,
        color: theme.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 1. Orbit Ring Background in Phase 1 */}
      {!isImpactPhase && (
        <div
          style={{
            position: "absolute",
            width: 780,
            height: 780,
            borderRadius: "50%",
            border: `1.5px dashed rgba(255, 255, 255, 0.12)`,
            opacity: hookReveal,
            transform: `rotate(${frame * 0.4}deg)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* 2. Orbiting Capability Chips */}
      {!isImpactPhase && (
        <div
          style={{
            position: "absolute",
            width: 1080,
            height: 1920,
            inset: 0,
            pointerEvents: "none",
          }}
        >
          {agentCapabilities.map((item, idx) => {
            const rad = (item.angle * Math.PI) / 180;
            const cx = 540 + Math.cos(rad) * item.r;
            const cy = 960 + Math.sin(rad) * (item.r * 0.85);

            const itemDelay = 6 + idx * 3;
            const itemSpring = spring({
              frame: frame - itemDelay,
              fps,
              config: {damping: 15, stiffness: 160},
            });

            return (
              <div
                key={item.label}
                style={{
                  position: "absolute",
                  left: cx,
                  top: cy,
                  transform: `translate(-50%, -50%) scale(${itemSpring})`,
                  opacity: itemSpring,
                  padding: "14px 24px",
                  borderRadius: 100,
                  background: "rgba(16, 20, 28, 0.9)",
                  border: `1px solid ${theme.lineStrong}`,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
                  font: `600 28px ${theme.fontSans}`,
                  color: theme.textSecondary,
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Center Agent Core & Question (Phase 1) */}
      {!isImpactPhase && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            zIndex: 10,
          }}
        >
          {/* 3D Holographic Core Canvas */}
          <div style={{opacity: hookReveal, marginBottom: -40}}>
            <HolographicCore3D size={460} accentColor={accentColor} />
          </div>

          <GlowBadge text="ARCHITECTURE DEEP DIVE" variant="cyan" size="md" />

          <div
            style={{
              marginTop: 32,
              font: `700 68px/1.25 ${theme.fontSans}`,
              letterSpacing: -1,
              opacity: questionOpacity,
              transform: `translateY(${questionY}px)`,
              maxWidth: 900,
            }}
          >
            一个可替换、可恢复的
            <br />
            <span style={{color: theme.accentLight}}>工业级 Agent 运行时如何组装？</span>
          </div>
        </div>
      )}

      {/* 4. Impact Phase: HARNESS REVEAL (Phase 2) */}
      {isImpactPhase && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            transform: `scale(${impactSpring})`,
            zIndex: 20,
          }}
        >
          <GlowBadge text="SOURCE LEVEL DISSECTION" variant="accent" size="lg" />

          <div
            style={{
              marginTop: 36,
              font: `800 102px ${theme.fontMono}`,
              letterSpacing: 3,
              color: "#FFFFFF",
              textShadow: `0 0 ${80 * impactGlow}px ${accentColor}, 0 0 20px ${accentColor}`,
            }}
          >
            {copy.harness}
          </div>

          <div
            style={{
              marginTop: 18,
              font: `600 44px ${theme.fontSans}`,
              color: theme.textSecondary,
              letterSpacing: 1,
            }}
          >
            {copy.harnessSubtitle}
          </div>

          <div
            style={{
              marginTop: 32,
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "12px 28px",
              borderRadius: 100,
              background: "rgba(59, 130, 246, 0.12)",
              border: `1px solid rgba(96, 165, 250, 0.4)`,
              font: `500 24px ${theme.fontMono}`,
              color: theme.accentLight,
            }}
          >
            <span>SHA 47f9438</span>
            <span style={{color: theme.faint}}>•</span>
            <span>12 章源码级事实推导</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};


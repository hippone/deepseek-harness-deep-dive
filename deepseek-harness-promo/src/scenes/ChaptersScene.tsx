import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {GlowBadge} from "../components/GlowBadge";
import {theme} from "../theme";

const pillars = [
  {
    icon: "🧩",
    name: "Cordis 动态插件树",
    desc: "Profile/Bundle 装配，Web 与 Headless 统一内核",
    tag: "CORDIS_CORE",
    color: theme.accentCyan,
  },
  {
    icon: "🔌",
    name: "能力 Seam 边界解耦",
    desc: "模型/文件/进程/沙箱独立 Definition & Provider",
    tag: "PLUGGABLE_SEAM",
    color: theme.accentEmerald,
  },
  {
    icon: "🧬",
    name: "单向派生会话事实",
    desc: "deriveMessages 投影上下文，杜绝状态漂移",
    tag: "EVENT_DERIVATION",
    color: theme.accentAmber,
  },
  {
    icon: "🛡️",
    name: "安全与信任控制面",
    desc: "审批拦截、凭据保护与沙箱副作用最小化",
    tag: "SANDBOX_GUARD",
    color: theme.accentPurple,
  },
] as const;

export const ChaptersScene: React.FC<{accentColor?: string}> = ({
  accentColor = theme.accent,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const titleSpring = spring({
    frame,
    fps,
    config: {damping: 18, stiffness: 120},
  });

  return (
    <AbsoluteFill
      style={{
        padding: `${theme.safeTop}px ${theme.safeX}px ${theme.safeBottom}px`,
        color: theme.text,
      }}
    >
      {/* 1. Header */}
      <div style={{transform: `scale(${titleSpring})`, transformOrigin: "left top"}}>
        <GlowBadge text="03 • FOUR ARCHITECTURAL PILLARS" variant="accent" size="sm" />
        <div style={{marginTop: 20, font: `700 76px ${theme.fontSans}`, letterSpacing: -1}}>
          Harness 4 大核心支柱
        </div>
        <div style={{marginTop: 12, font: `400 32px ${theme.fontSans}`, color: theme.muted}}>
          将复杂 Agent 工程解构为清晰可控的工业级底座
        </div>
      </div>

      {/* 2. Four Pillar Cards 2x2 Grid */}
      <div
        style={{
          marginTop: 48,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        {pillars.map((item, index) => {
          const itemDelay = 18 + index * 18;
          const itemReveal = interpolate(
            frame - itemDelay,
            [0, 20],
            [0, 1],
            {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)}
          );
          const translateY = (1 - itemReveal) * 25;

          return (
            <div
              key={item.name}
              style={{
                height: 290,
                padding: "36px 30px",
                borderRadius: theme.radius,
                border: `1.5px solid ${itemReveal > 0.5 ? item.color : theme.lineStrong}`,
                background: "rgba(16, 20, 28, 0.8)",
                backdropFilter: "blur(20px)",
                boxShadow: `0 15px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 35px ${item.color}20`,
                opacity: itemReveal,
                transform: `translateY(${translateY}px)`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                  <span style={{fontSize: 44}}>{item.icon}</span>
                  <span
                    style={{
                      font: `600 16px ${theme.fontMono}`,
                      color: item.color,
                      padding: "4px 10px",
                      borderRadius: 100,
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${item.color}40`,
                    }}
                  >
                    {item.tag}
                  </span>
                </div>
                <div style={{marginTop: 22, font: `700 42px ${theme.fontSans}`, color: theme.text}}>
                  {item.name}
                </div>
              </div>

              <div style={{font: `400 24px ${theme.fontSans}`, color: theme.muted, lineHeight: 1.35}}>
                {item.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Bottom Chapters Overview Banner */}
      <div
        style={{
          marginTop: 36,
          padding: "26px 32px",
          borderRadius: theme.radiusSm,
          background: "rgba(23, 29, 42, 0.8)",
          border: `1px solid ${theme.lineStrong}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: interpolate(frame, [80, 100], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div style={{display: "flex", alignItems: "center", gap: 16}}>
          <span style={{fontSize: 32}}>📖</span>
          <div>
            <div style={{font: `700 30px ${theme.fontSans}`, color: theme.text}}>
              全书 12 章深度解构
            </div>
            <div style={{font: `400 22px ${theme.fontSans}`, color: theme.muted}}>
              从主循环、Cordis、会话状态到权限模型
            </div>
          </div>
        </div>

        <span
          style={{
            font: `700 22px ${theme.fontMono}`,
            color: accentColor,
            padding: "8px 18px",
            borderRadius: 100,
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}40`,
          }}
        >
          12 CHAPTERS →
        </span>
      </div>
    </AbsoluteFill>
  );
};


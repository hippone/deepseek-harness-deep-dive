import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {CodeWindow} from "../components/CodeWindow";
import {GlowBadge} from "../components/GlowBadge";
import {theme} from "../theme";

const agentLoopCode = [
  {
    lineNum: "01",
    tokens: [
      {text: "class ", color: "#F43F5E", bold: true},
      {text: "AgentLoopService ", color: "#60A5FA", bold: true},
      {text: "extends ", color: "#F43F5E"},
      {text: "Service {"},
    ],
  },
  {
    lineNum: "02",
    tokens: [
      {text: "  async ", color: "#F43F5E"},
      {text: "runStep(session, turn) {"},
    ],
  },
  {
    lineNum: "03",
    tokens: [
      {text: "    const ", color: "#60A5FA"},
      {text: "msgs = session."},
      {text: "deriveMessages", color: "#22D3EE", bold: true},
      {text: "(); // 唯一事实投影"},
    ],
  },
  {
    lineNum: "04",
    tokens: [
      {text: "    const ", color: "#60A5FA"},
      {text: "events = await this."},
      {text: "tools.dispatch", color: "#34D399", bold: true},
      {text: "(turn);"},
    ],
  },
  {
    lineNum: "05",
    tokens: [
      {text: "    await session."},
      {text: "commitEvents", color: "#FBBF24", bold: true},
      {text: "(events); // 日志落盘"},
    ],
  },
  {
    lineNum: "06",
    tokens: [{text: "  }"}],
  },
  {
    lineNum: "07",
    tokens: [{text: "}"}],
  },
];

const pillars = [
  {id: "01", title: "Cordis 服务微内核", subtitle: "服务随生命周期动态注册与安全撤销", color: theme.accentCyan},
  {id: "02", title: "SessionEvent 持久事实", subtitle: "拒绝内存状态漂移，单向派生上下文", color: theme.accentEmerald},
  {id: "03", title: "能力 Seam 边界解耦", subtitle: "模型、工具、沙箱独立 Definition/Provider", color: theme.accentAmber},
] as const;

export const SourceScene: React.FC<{accentColor?: string}> = ({
  accentColor = theme.accent,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const titleSpring = spring({
    frame,
    fps,
    config: {damping: 18, stiffness: 120},
  });

  const codeSpring = spring({
    frame: frame - 20,
    fps,
    config: {damping: 18, stiffness: 110},
  });

  // Highlight lines with comfortable pacing
  const activeLine = frame > 160 ? 4 : frame > 100 ? 3 : frame > 40 ? 2 : 1;

  return (
    <AbsoluteFill
      style={{
        padding: `${theme.safeTop}px ${theme.safeX}px ${theme.safeBottom}px`,
        color: theme.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 1. Header */}
      <div style={{transform: `scale(${titleSpring})`, transformOrigin: "left top"}}>
        <GlowBadge text="01 • RUNTIME ASSEMBLY" variant="accent" size="sm" />
        <div
          style={{
            marginTop: 20,
            font: `700 68px/1.22 ${theme.fontSans}`,
            letterSpacing: -1,
          }}
        >
          不只是简单的模型调用
          <br />
          <span style={{color: accentColor}}>而是可替换、可撤销的运行时组装</span>
        </div>
      </div>

      {/* 2. Real Code Window */}
      <div
        style={{
          marginTop: 48,
          transform: `scale(${codeSpring})`,
          transformOrigin: "center top",
          opacity: interpolate(frame, [10, 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <CodeWindow
          fileName="engine_loop.rs"
          codeLines={agentLoopCode}
          highlightLine={activeLine}
          width={920}
        />
      </div>

      {/* 3. Three Pillars Grid */}
      <div
        style={{
          marginTop: 48,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {pillars.map((item, idx) => {
          const itemDelay = 60 + idx * 28;
          const isItemActive = frame >= itemDelay;
          const itemReveal = interpolate(
            frame - itemDelay,
            [0, 20],
            [0, 1],
            {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)}
          );

          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                padding: "22px 30px",
                borderRadius: theme.radiusSm,
                background: isItemActive ? "rgba(16, 20, 28, 0.85)" : "rgba(16, 20, 28, 0.4)",
                border: `1.5px solid ${isItemActive ? item.color : theme.line}`,
                boxShadow: isItemActive ? `0 0 30px ${item.color}25` : "none",
                opacity: itemReveal,
                transform: `translateX(${(1 - itemReveal) * 30}px)`,
              }}
            >
              <span
                style={{
                  font: `700 32px ${theme.fontMono}`,
                  color: item.color,
                }}
              >
                {item.id}
              </span>
              <div>
                <div style={{font: `700 36px ${theme.fontSans}`, color: theme.text}}>
                  {item.title}
                </div>
                <div style={{font: `400 24px ${theme.fontSans}`, color: theme.muted, marginTop: 4}}>
                  {item.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};


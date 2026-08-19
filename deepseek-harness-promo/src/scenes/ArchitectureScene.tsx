import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {ArchitectureNode} from "../components/ArchitectureNode";
import {ExecutionPulse} from "../components/ExecutionPulse";
import {GlowBadge} from "../components/GlowBadge";
import {theme} from "../theme";

const steps = [
  {
    stepNumber: "01",
    label: "INBOX & TURN",
    title: "任务摄入与轮次解构",
    detail: "明确拆解 Turn 与 Step，隔离单步执行上下文",
    statusTag: "TURN_INIT",
    iconType: "input" as const,
  },
  {
    stepNumber: "02",
    label: "REASON & ROUTE",
    title: "动态思维链与工具路由",
    detail: "模型结构化推理，生成类型安全的工具调用契约",
    statusTag: "ROUTING",
    iconType: "plan" as const,
  },
  {
    stepNumber: "03",
    label: "SANDBOX & GUARD",
    title: "副作用隔离与权限审批",
    detail: "文件、终端沙箱受控执行，拦截未授权高危动作",
    statusTag: "DISPATCHING",
    iconType: "tool" as const,
  },
  {
    stepNumber: "04",
    label: "PERSISTENT LOG",
    title: "SessionEvent 事实持久化",
    detail: "线性事件日志落盘，支持确定性重放与崩溃恢复",
    statusTag: "COMMITTED",
    iconType: "state" as const,
  },
] as const;

export const ArchitectureScene: React.FC<{accentColor?: string}> = ({
  accentColor = theme.accent,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const titleSpring = spring({
    frame,
    fps,
    config: {damping: 18, stiffness: 120},
  });

  // Calculate active node based on 12-second timeline (360 frames)
  const activeIdx =
    frame > 260 ? 3 : frame > 180 ? 2 : frame > 100 ? 1 : frame > 20 ? 0 : -1;

  const pulseProgress = interpolate(frame, [25, 330], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
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
        <GlowBadge text="02 • PIPELINE STATE MACHINE" variant="cyan" size="sm" />
        <div style={{marginTop: 20, font: `700 76px ${theme.fontSans}`, letterSpacing: -1}}>
          Harness 执行流水线
        </div>
      </div>

      {/* 2. Glowing Laser Pipe */}
      <ExecutionPulse progress={pulseProgress} top={460} height={760} accentColor={accentColor} />

      {/* 3. Four Architecture Nodes */}
      <div
        style={{
          marginTop: 40,
          marginLeft: 40,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {steps.map((step, index) => (
          <ArchitectureNode
            key={step.stepNumber}
            stepNumber={step.stepNumber}
            label={step.label}
            title={step.title}
            detail={step.detail}
            statusTag={step.statusTag}
            iconType={step.iconType}
            index={index}
            accentColor={accentColor}
            isActive={activeIdx === index}
          />
        ))}
      </div>

      {/* 4. Footer Summary */}
      <div
        style={{
          position: "absolute",
          left: theme.safeX,
          right: theme.safeX,
          bottom: theme.safeBottom - 20,
          textAlign: "center",
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(frame, [230, 255], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <GlowBadge
          text="✨ 单向受控流转 • 状态确定性"
          variant="accent"
          size="md"
          hasDot={false}
        />
      </div>
    </AbsoluteFill>
  );
};


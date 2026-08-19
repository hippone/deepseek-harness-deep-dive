import {Easing, interpolate, useCurrentFrame} from "remotion";
import {theme} from "../theme";

type ArchitectureNodeProps = {
  title: string;
  label: string;
  stepNumber: string;
  statusTag: string;
  index: number;
  accentColor: string;
  detail: string;
  iconType: "input" | "plan" | "tool" | "state";
  isActive?: boolean;
};

const renderIcon = (type: ArchitectureNodeProps["iconType"], color: string) => {
  switch (type) {
    case "input":
      return (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      );
    case "plan":
      return (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l3 3" />
        </svg>
      );
    case "tool":
      return (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "state":
      return (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
  }
};

export const ArchitectureNode: React.FC<ArchitectureNodeProps> = ({
  title,
  label,
  stepNumber,
  statusTag,
  index,
  accentColor,
  detail,
  iconType,
  isActive = false,
}) => {
  const frame = useCurrentFrame();
  const start = 20 + index * 75;

  const reveal = interpolate(frame, [start, start + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const translateY = interpolate(frame, [start, start + 22], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const activeGlow = isActive
    ? `0 0 45px ${accentColor}44, 0 12px 35px rgba(0,0,0,0.6)`
    : "0 10px 30px rgba(0,0,0,0.4)";

  return (
    <div
      style={{
        position: "relative",
        width: 860,
        padding: "32px 36px",
        borderRadius: theme.radius,
        border: `1.5px solid ${isActive ? accentColor : theme.lineStrong}`,
        background: isActive
          ? `linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.85))`
          : "rgba(16, 20, 28, 0.75)",
        backdropFilter: "blur(20px)",
        boxShadow: activeGlow,
        opacity: reveal,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        alignItems: "center",
        gap: 28,
      }}
    >
      {/* 1. Left Icon Container */}
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 22,
          background: isActive ? `${accentColor}25` : "rgba(255, 255, 255, 0.04)",
          border: `1.5px solid ${isActive ? accentColor : theme.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: isActive ? `0 0 25px ${accentColor}66` : "none",
        }}
      >
        {renderIcon(iconType, isActive ? accentColor : theme.muted)}
      </div>

      {/* 2. Middle Content */}
      <div style={{flex: 1}}>
        <div style={{display: "flex", alignItems: "center", gap: 14, marginBottom: 8}}>
          <span style={{font: `700 24px ${theme.fontMono}`, color: accentColor, letterSpacing: 2}}>
            {stepNumber}
          </span>
          <span style={{font: `500 24px ${theme.fontSans}`, color: theme.muted}}>
            {label}
          </span>
          <span
            style={{
              marginLeft: "auto",
              padding: "4px 14px",
              borderRadius: 100,
              background: isActive ? `${accentColor}20` : "rgba(255,255,255,0.05)",
              border: `1px solid ${isActive ? `${accentColor}80` : theme.line}`,
              font: `600 18px ${theme.fontMono}`,
              color: isActive ? accentColor : theme.muted,
              letterSpacing: 1,
            }}
          >
            {statusTag}
          </span>
        </div>

        <div style={{font: `700 48px ${theme.fontSans}`, color: theme.text, letterSpacing: -0.5}}>
          {title}
        </div>

        <div style={{marginTop: 8, font: `400 28px ${theme.fontSans}`, color: theme.muted, lineHeight: 1.4}}>
          {detail}
        </div>
      </div>
    </div>
  );
};


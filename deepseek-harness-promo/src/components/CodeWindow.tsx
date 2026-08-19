import {Easing, interpolate, useCurrentFrame} from "remotion";
import {theme} from "../theme";

type CodeWindowProps = {
  fileName?: string;
  codeLines: Array<{
    lineNum: string;
    tokens: Array<{text: string; color?: string; bold?: boolean}>;
  }>;
  highlightLine?: number;
  width?: number;
};

export const CodeWindow: React.FC<CodeWindowProps> = ({
  fileName = "harness_core.rs",
  codeLines,
  highlightLine,
  width = 900,
}) => {
  const frame = useCurrentFrame();

  const scanLineY = interpolate(frame % 90, [0, 90], [0, 360], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width,
        borderRadius: theme.radius,
        border: `1px solid ${theme.lineStrong}`,
        background: "rgba(13, 16, 23, 0.88)",
        backdropFilter: "blur(24px)",
        boxShadow: `${theme.shadowGlass}, 0 25px 80px rgba(0, 0, 0, 0.7)`,
        overflow: "hidden",
      }}
    >
      {/* 1. Window Header */}
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          borderBottom: `1px solid ${theme.line}`,
          background: "rgba(255, 255, 255, 0.02)",
        }}
      >
        {/* macOS Traffic Lights */}
        <div style={{display: "flex", gap: 10}}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#FF5F56",
              boxShadow: "0 0 8px rgba(255, 95, 86, 0.5)",
            }}
          />
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#FFBD2E",
              boxShadow: "0 0 8px rgba(255, 189, 46, 0.5)",
            }}
          />
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#27C93F",
              boxShadow: "0 0 8px rgba(39, 201, 63, 0.5)",
            }}
          />
        </div>

        {/* Tab / Filename */}
        <div
          style={{
            marginLeft: 24,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 18px",
            borderRadius: 12,
            background: "rgba(255, 255, 255, 0.04)",
            border: `1px solid ${theme.line}`,
            font: `500 22px ${theme.fontMono}`,
            color: theme.textSecondary,
          }}
        >
          <span style={{color: theme.accentCyan}}>⚡</span>
          <span>{fileName}</span>
        </div>

        {/* Git Tag */}
        <div
          style={{
            marginLeft: "auto",
            font: `500 20px ${theme.fontMono}`,
            color: theme.muted,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{width: 8, height: 8, borderRadius: "50%", background: theme.accentEmerald}} />
          <span>deepseek-harness@47f9438</span>
        </div>
      </div>

      {/* 2. Code Body */}
      <div
        style={{
          position: "relative",
          padding: "32px 36px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          font: `500 29px/1.45 ${theme.fontMono}`,
        }}
      >
        {/* Laser scanline */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: scanLineY,
            height: 2,
            background: "linear-gradient(90deg, transparent, rgba(96,165,250,0.8), transparent)",
            boxShadow: "0 0 15px rgba(96,165,250,0.8)",
            opacity: 0.6,
            pointerEvents: "none",
          }}
        />

        {codeLines.map((line, idx) => {
          const isHighlighted = highlightLine === idx + 1;
          const lineReveal = interpolate(
            frame - idx * 4,
            [0, 8],
            [0, 1],
            {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad)}
          );

          return (
            <div
              key={line.lineNum}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                padding: "4px 12px",
                borderRadius: 8,
                background: isHighlighted ? "rgba(59, 130, 246, 0.14)" : "transparent",
                borderLeft: isHighlighted ? `3px solid ${theme.accentLight}` : "3px solid transparent",
                opacity: lineReveal,
                transform: `translateX(${(1 - lineReveal) * 15}px)`,
              }}
            >
              <span
                style={{
                  color: isHighlighted ? theme.accentLight : theme.faint,
                  userSelect: "none",
                  width: 38,
                  textAlign: "right",
                }}
              >
                {line.lineNum}
              </span>
              <div style={{display: "flex", flexWrap: "wrap", gap: 4}}>
                {line.tokens.map((token, tIdx) => (
                  <span
                    key={tIdx}
                    style={{
                      color: token.color || theme.text,
                      fontWeight: token.bold ? 700 : 500,
                      textShadow: token.color ? `0 0 12px ${token.color}40` : "none",
                    }}
                  >
                    {token.text}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

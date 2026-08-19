import {interpolate} from "remotion";
import {theme} from "../theme";

type ExecutionPulseProps = {
  progress: number;
  top: number;
  height: number;
  accentColor?: string;
};

export const ExecutionPulse: React.FC<ExecutionPulseProps> = ({
  progress,
  top,
  height,
  accentColor = theme.accent,
}) => {
  const currentY = top + interpolate(progress, [0, 1], [0, height], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <svg
        width="1080"
        height="1920"
        viewBox="0 0 1080 1920"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        <defs>
          <linearGradient id="pipe-glow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.8" />
            <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Background Pipeline Track */}
        <path
          d={`M 150 ${top} L 150 ${top + height}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* 2. Lit Active Path */}
        <path
          d={`M 150 ${top} L 150 ${currentY}`}
          fill="none"
          stroke="url(#pipe-glow)"
          strokeWidth="6"
          strokeLinecap="round"
          filter="url(#glow-blur)"
        />
      </svg>

      {/* 3. High Energy Particle Comet Head */}
      <div
        style={{
          position: "absolute",
          left: 136,
          top: currentY - 14,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "#FFFFFF",
          boxShadow: `0 0 20px ${accentColor}, 0 0 45px #22D3EE, 0 0 70px ${accentColor}`,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
    </>
  );
};


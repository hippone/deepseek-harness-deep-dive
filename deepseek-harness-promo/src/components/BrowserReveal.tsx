import {Img, interpolate, staticFile, useCurrentFrame} from "remotion";
import {theme} from "../theme";
import {MosaicUrl} from "./MosaicUrl";

export const BrowserReveal: React.FC<{progress: number; accentColor: string}> = ({
  progress,
  accentColor,
}) => {
  const frame = useCurrentFrame();

  const lightSweep = interpolate(frame % 100, [0, 100], [-300, 1200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width: 880,
        borderRadius: 32,
        border: `1.5px solid ${theme.lineStrong}`,
        background: "rgba(13, 16, 23, 0.92)",
        backdropFilter: "blur(30px)",
        boxShadow: `0 35px 100px rgba(0,0,0,0.75), 0 0 80px ${accentColor}25, inset 0 1px 0 rgba(255,255,255,0.15)`,
        transform: `scale(${0.92 + progress * 0.08})`,
        overflow: "hidden",
      }}
    >
      {/* 1. Top Browser Chrome */}
      <div
        style={{
          height: 72,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 28px",
          borderBottom: `1px solid ${theme.line}`,
          background: "rgba(255, 255, 255, 0.03)",
        }}
      >
        {/* Window Controls */}
        <div style={{display: "flex", gap: 10}}>
          <span style={{width: 14, height: 14, borderRadius: "50%", background: "#FF5F56"}} />
          <span style={{width: 14, height: 14, borderRadius: "50%", background: "#FFBD2E"}} />
          <span style={{width: 14, height: 14, borderRadius: "50%", background: "#27C93F"}} />
        </div>

        {/* Address Bar */}
        <div
          style={{
            marginLeft: 20,
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 20px",
            borderRadius: 100,
            border: `1px solid ${theme.line}`,
            background: "rgba(0, 0, 0, 0.3)",
            font: `500 20px ${theme.fontMono}`,
            color: theme.muted,
          }}
        >
          <span style={{color: theme.accentEmerald}}>🔒</span>
          <MosaicUrl compact />
        </div>
      </div>

      {/* 2. Web View Content */}
      <div
        style={{
          position: "relative",
          height: 660,
          overflow: "hidden",
          background: "#08090C",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <Img
          src={staticFile("site/homepage-hero.png")}
          style={{
            width: "100%",
            height: "auto",
            objectFit: "cover",
            filter: "contrast(1.05)",
          }}
        />

        {/* Glass reflection beam */}
        <div
          style={{
            position: "absolute",
            left: lightSweep,
            top: 0,
            bottom: 0,
            width: 180,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            transform: "skewX(-25deg)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};


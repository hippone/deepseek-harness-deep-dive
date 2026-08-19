import {AbsoluteFill} from "remotion";

export const NoiseOverlay: React.FC = () => (
  <AbsoluteFill
    style={{
      opacity: 0.09,
      pointerEvents: "none",
      backgroundImage:
        "radial-gradient(circle at 12% 18%, rgba(255,255,255,.22) 0 0.7px, transparent 0.9px), radial-gradient(circle at 72% 64%, rgba(255,255,255,.14) 0 0.6px, transparent 0.8px)",
      backgroundSize: "13px 17px, 19px 23px",
      mixBlendMode: "soft-light",
    }}
  />
);

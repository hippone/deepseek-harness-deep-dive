import {theme} from "../theme";

export const MosaicUrl: React.FC<{compact?: boolean}> = ({compact = false}) => (
  <span style={{display: "inline-flex", alignItems: "center", gap: compact ? 8 : 12, whiteSpace: "nowrap"}}>
    <span
      aria-hidden="true"
      style={{
        width: compact ? 144 : 176,
        height: compact ? 20 : 24,
        display: "inline-block",
        borderRadius: 4,
        border: `1px solid ${theme.line}`,
        backgroundColor: "#2A303B",
        backgroundImage:
          "repeating-conic-gradient(from 45deg, #7d8797 0 25%, #303845 0 50%, #596476 0 75%, #202733 0 100%)",
        backgroundSize: compact ? "9px 9px" : "11px 11px",
        boxShadow: "inset 0 0 0 2px rgba(0,0,0,.28)",
      }}
    />
    <span>/deepseek-harness-internals</span>
  </span>
);

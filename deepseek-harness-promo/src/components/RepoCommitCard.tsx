import {Easing, interpolate, useCurrentFrame} from "remotion";
import {copy} from "../data/copy";
import {theme} from "../theme";

export const RepoCommitCard: React.FC<{accentColor: string}> = ({accentColor}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "relative",
        width: 900,
        padding: 46,
        borderRadius: 30,
        border: `1.5px solid ${theme.lineStrong}`,
        background: theme.surface,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.07)",
        opacity: interpolate(frame, [5, 17], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        translate: `0 ${interpolate(frame, [5, 17], [28, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}px`,
      }}
    >
      <div style={{display: "flex", gap: 12, marginBottom: 38}}>
        {[0, 1, 2].map((dot) => (
          <span key={dot} style={{width: 13, height: 13, borderRadius: "50%", background: theme.lineStrong}} />
        ))}
        <span style={{marginLeft: "auto", font: `24px ${theme.fontMono}`, color: theme.faint}}>
          SOURCE SNAPSHOT
        </span>
      </div>
      <div style={{font: `30px ${theme.fontMono}`, color: theme.muted}}>repository</div>
      <div style={{marginTop: 10, font: `600 43px ${theme.fontMono}`, color: theme.text}}>
        {copy.repository}
      </div>
      <div
        style={{
          marginTop: 34,
          display: "inline-flex",
          gap: 16,
          padding: "13px 20px",
          border: `1px solid ${accentColor}66`,
          borderRadius: 100,
          font: `28px ${theme.fontMono}`,
          color: accentColor,
          background: `${accentColor}12`,
        }}
      >
        <span>snapshot</span>
        <strong>{copy.snapshot}</strong>
      </div>
      <div
        style={{
          position: "absolute",
          left: 46,
          right: 46,
          top: interpolate(frame, [20, 88], [130, 370], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          boxShadow: `0 0 22px ${accentColor}`,
          opacity: interpolate(frame, [18, 25, 80, 90], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </div>
  );
};

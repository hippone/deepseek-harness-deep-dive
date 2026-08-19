import {Easing, interpolate, useCurrentFrame} from "remotion";
import {chapters, chapterFocus} from "../data/chapters";
import {theme} from "../theme";

export const ChapterGrid: React.FC<{accentColor: string}> = ({accentColor}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, width: 912}}>
      {chapters.map((chapter, index) => {
        const start = 10 + index * 3;
        const isFocus = chapterFocus.has(index);
        const evidence = frame > 92 && index === 8;
        return (
          <div
            key={chapter}
            style={{
              height: 98,
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "0 24px",
              border: `1px solid ${isFocus || evidence ? `${accentColor}88` : theme.line}`,
              borderRadius: 18,
              background: isFocus || evidence ? `${accentColor}12` : theme.surface,
              opacity: interpolate(frame, [start, start + 9, 118, 136], [0, 1, 1, 0.1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: `0 ${interpolate(frame, [start, start + 9], [22, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })}px`,
            }}
          >
            <span style={{font: `28px ${theme.fontMono}`, color: isFocus ? accentColor : theme.faint}}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span style={{font: `500 34px ${theme.fontSans}`, color: theme.text}}>
              {evidence ? "证据索引" : chapter}
            </span>
          </div>
        );
      })}
    </div>
  );
};

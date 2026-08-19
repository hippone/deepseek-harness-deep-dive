import {Audio} from "@remotion/media";
import {AbsoluteFill, Sequence, interpolate, staticFile} from "remotion";
import {TechGridBackground} from "./components/TechGridBackground";
import {ArchitectureScene} from "./scenes/ArchitectureScene";
import {ChaptersScene} from "./scenes/ChaptersScene";
import {CoreMessageScene} from "./scenes/CoreMessageScene";
import {HookScene} from "./scenes/HookScene";
import {SourceScene} from "./scenes/SourceScene";
import {WebsiteRevealScene} from "./scenes/WebsiteRevealScene";
import {theme} from "./theme";
import {timeline} from "./timeline";

export type DeepSeekHarnessPromoProps = {
  accentColor?: string;
  siteUrl?: string;
  showAudio?: boolean;
  showDebugGuides?: boolean;
};

export const DeepSeekHarnessPromo: React.FC<DeepSeekHarnessPromoProps> = ({
  accentColor = theme.accent,
  showAudio = true,
  showDebugGuides = false,
}) => {
  return (
    <AbsoluteFill
      style={{
        background: theme.background,
        overflow: "hidden",
        fontFamily: theme.fontSans,
      }}
    >
      {/* 1. Global Ambient Grid & Glow Background */}
      <TechGridBackground accentColor={accentColor} />

      {/* 2. Scene Sequences */}
      <Sequence from={timeline.hook.from} durationInFrames={timeline.hook.duration} name="01 Hook">
        <HookScene accentColor={accentColor} />
      </Sequence>

      <Sequence from={timeline.source.from} durationInFrames={timeline.source.duration} name="02 Source-level">
        <SourceScene accentColor={accentColor} />
      </Sequence>

      <Sequence from={timeline.architecture.from} durationInFrames={timeline.architecture.duration} name="03 Harness Architecture">
        <ArchitectureScene accentColor={accentColor} />
      </Sequence>

      <Sequence from={timeline.chapters.from} durationInFrames={timeline.chapters.duration} name="04 Chapters">
        <ChaptersScene accentColor={accentColor} />
      </Sequence>

      <Sequence from={timeline.message.from} durationInFrames={timeline.message.duration} name="05 Core Message">
        <CoreMessageScene accentColor={accentColor} />
      </Sequence>

      <Sequence from={timeline.website.from} durationInFrames={timeline.website.duration} name="06 Website Reveal">
        <WebsiteRevealScene accentColor={accentColor} />
      </Sequence>

      {/* 3. High Precision Audio Sync & Background Music */}
      {showAudio ? (
        <>
          {/* Continuous Calm Ambient Tech Soundtrack */}
          <Audio
            src={staticFile("audio/bgm.wav")}
            from={0}
            volume={(audioFrame) =>
              interpolate(audioFrame, [0, 60, 1280, 1350], [0, 0.75, 0.75, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            }
          />

          {/* Main Key Moment Impacts */}
          <Audio
            src={staticFile("audio/impact.wav")}
            from={timeline.hook.from + 105}
            volume={(audioFrame) =>
              interpolate(audioFrame, [0, 4, 45], [0, 0.85, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            }
          />
          <Audio
            src={staticFile("audio/impact.wav")}
            from={timeline.message.from + 70}
            volume={(audioFrame) =>
              interpolate(audioFrame, [0, 4, 45], [0, 0.75, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            }
          />

          {/* Ultra-soft scene transition air swooshes */}
          {[timeline.architecture.from, timeline.chapters.from, timeline.website.from].map((from) => (
            <Audio
              key={from}
              src={staticFile("audio/whoosh.wav")}
              from={from}
              volume={(audioFrame) =>
                interpolate(audioFrame, [0, 6, 20], [0, 0.08, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              }
            />
          ))}
        </>
      ) : null}

      {/* 4. Optional Safe Guides */}
      {showDebugGuides ? (
        <>
          <div
            style={{
              position: "absolute",
              inset: `0 0 auto 0`,
              height: theme.safeTop,
              background: "rgba(255,80,80,.08)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: `auto 0 0 0`,
              height: theme.safeBottom,
              background: "rgba(255,80,80,.08)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: theme.safeX,
              right: theme.safeX,
              top: theme.safeTop,
              bottom: theme.safeBottom,
              border: "2px dashed rgba(255,80,80,.72)",
              pointerEvents: "none",
            }}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};


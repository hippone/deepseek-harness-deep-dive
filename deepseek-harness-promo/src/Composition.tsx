import {Composition, Folder} from "remotion";
import {DeepSeekHarnessPromo} from "./DeepSeekHarnessPromo";
import {ArchitectureScene} from "./scenes/ArchitectureScene";
import {ChaptersScene} from "./scenes/ChaptersScene";
import {CoreMessageScene} from "./scenes/CoreMessageScene";
import {HookScene} from "./scenes/HookScene";
import {SourceScene} from "./scenes/SourceScene";
import {WebsiteRevealScene} from "./scenes/WebsiteRevealScene";
import {FPS, timeline, TOTAL_FRAMES} from "./timeline";

const accentColor = "#6799FE";

export const VideoCompositions: React.FC = () => (
  <>
    <Composition
      id="DeepSeekHarnessPromo"
      component={DeepSeekHarnessPromo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{
        accentColor,
        siteUrl: "https://hippone.github.io/deepseek-harness-internals/",
        showAudio: true,
        showDebugGuides: false,
      }}
    />
    <Folder name="DeepSeekHarnessPromo-Scenes">
      <Composition id="Scene01Hook" component={HookScene} durationInFrames={timeline.hook.duration} fps={FPS} width={1080} height={1920} defaultProps={{accentColor}} />
      <Composition id="Scene02Source" component={SourceScene} durationInFrames={timeline.source.duration} fps={FPS} width={1080} height={1920} defaultProps={{accentColor}} />
      <Composition id="Scene03Architecture" component={ArchitectureScene} durationInFrames={timeline.architecture.duration} fps={FPS} width={1080} height={1920} defaultProps={{accentColor}} />
      <Composition id="Scene04Chapters" component={ChaptersScene} durationInFrames={timeline.chapters.duration} fps={FPS} width={1080} height={1920} defaultProps={{accentColor}} />
      <Composition id="Scene05Message" component={CoreMessageScene} durationInFrames={timeline.message.duration} fps={FPS} width={1080} height={1920} defaultProps={{accentColor}} />
      <Composition id="Scene06Website" component={WebsiteRevealScene} durationInFrames={timeline.website.duration} fps={FPS} width={1080} height={1920} defaultProps={{accentColor}} />
    </Folder>
  </>
);

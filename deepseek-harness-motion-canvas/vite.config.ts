import {defineConfig} from "vite";
import motionCanvasPkg from "@motion-canvas/vite-plugin";

const motionCanvas = (motionCanvasPkg as any).default || motionCanvasPkg;

export default defineConfig({
  plugins: [
    motionCanvas(),
  ],
});


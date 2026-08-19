import {interpolate, useCurrentFrame} from "remotion";
import {useEffect, useRef} from "react";
import {theme} from "../theme";

type Point3D = {x: number; y: number; z: number};

// Cube Vertices
const r = 90;
const vertices: Point3D[] = [
  {x: -r, y: -r, z: -r},
  {x: r, y: -r, z: -r},
  {x: r, y: r, z: -r},
  {x: -r, y: r, z: -r},
  {x: -r, y: -r, z: r},
  {x: r, y: -r, z: r},
  {x: r, y: r, z: r},
  {x: -r, y: r, z: r},
];

// Cube Edges
const edges = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

// Inner Diamond Vertices
const rd = 55;
const diamondVertices: Point3D[] = [
  {x: 0, y: -rd * 1.3, z: 0},
  {x: rd, y: 0, z: 0},
  {x: 0, y: 0, z: rd},
  {x: -rd, y: 0, z: 0},
  {x: 0, y: 0, z: -rd},
  {x: 0, y: rd * 1.3, z: 0},
];

const diamondEdges = [
  [0, 1], [0, 2], [0, 3], [0, 4],
  [5, 1], [5, 2], [5, 3], [5, 4],
  [1, 2], [2, 3], [3, 4], [4, 1],
];

// Floating particles
const particleCount = 36;
const baseParticles: Point3D[] = Array.from({length: particleCount}, (_, i) => {
  const phi = Math.acos(-1 + (2 * i) / particleCount);
  const theta = Math.sqrt(particleCount * Math.PI) * phi;
  const radius = 150 + (i % 5) * 15;
  return {
    x: radius * Math.cos(theta) * Math.sin(phi),
    y: radius * Math.sin(theta) * Math.sin(phi),
    z: radius * Math.cos(phi),
  };
});

const rotatePoint = (p: Point3D, rx: number, ry: number, rz: number): Point3D => {
  // Rotate Y
  const x1 = p.x * Math.cos(ry) + p.z * Math.sin(ry);
  const y1 = p.y;
  const z1 = -p.x * Math.sin(ry) + p.z * Math.cos(ry);

  // Rotate X
  const x2 = x1;
  const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);

  // Rotate Z
  const x3 = x2 * Math.cos(rz) - y2 * Math.sin(rz);
  const y3 = x2 * Math.sin(rz) + y2 * Math.cos(rz);
  const z3 = z2;

  return {x: x3, y: y3, z: z3};
};

const project = (p: Point3D, w: number, h: number) => {
  const fov = 380;
  const distance = 420;
  const scale = fov / (distance + p.z);
  return {
    x: w / 2 + p.x * scale,
    y: h / 2 + p.y * scale,
    scale,
    z: p.z,
  };
};

export const HolographicCore3D: React.FC<{
  size?: number;
  accentColor?: string;
}> = ({
  size = 500,
  accentColor = theme.accent,
}) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 3D Rotation angles based on Remotion frame
  const rotX = (frame * 0.015) % (Math.PI * 2);
  const rotY = (frame * 0.022) % (Math.PI * 2);
  const rotZ = (frame * 0.008) % (Math.PI * 2);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    // 1. Draw Orbit Ring
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(frame * 0.01);
    ctx.beginPath();
    ctx.ellipse(0, 0, 180, 70, Math.PI / 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(6, 182, 212, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.restore();

    // 2. Project & Draw Outer Cube
    const projVertices = vertices.map((v) =>
      project(rotatePoint(v, rotX, rotY, rotZ), size, size)
    );

    ctx.beginPath();
    edges.forEach(([i, j]) => {
      const p1 = projVertices[i];
      const p2 = projVertices[j];
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    });
    ctx.strokeStyle = "rgba(96, 165, 250, 0.45)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Draw cube corner vertices
    projVertices.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * p.scale, 0, Math.PI * 2);
      ctx.fillStyle = "#60A5FA";
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 10;
      ctx.fill();
    });

    // 3. Project & Draw Inner Diamond
    const projDiamond = diamondVertices.map((v) =>
      project(rotatePoint(v, -rotX * 1.5, -rotY * 1.5, rotZ), size, size)
    );

    ctx.beginPath();
    diamondEdges.forEach(([i, j]) => {
      const p1 = projDiamond[i];
      const p2 = projDiamond[j];
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    });
    ctx.strokeStyle = "rgba(34, 211, 238, 0.75)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Project & Draw Floating 3D Star Particles
    baseParticles.forEach((pt, idx) => {
      const animatedPt = {
        ...pt,
        x: pt.x + Math.sin(frame * 0.05 + idx) * 8,
        y: pt.y + Math.cos(frame * 0.05 + idx) * 8,
      };
      const projPt = project(rotatePoint(animatedPt, rotX * 0.8, rotY * 0.8, rotZ * 0.8), size, size);
      const alpha = interpolate(projPt.z, [-180, 180], [0.15, 0.9], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      ctx.beginPath();
      ctx.arc(projPt.x, projPt.y, 2.5 * projPt.scale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = "#38BDF8";
      ctx.shadowBlur = 8;
      ctx.fill();
    });
  }, [frame, size, rotX, rotY, rotZ, accentColor]);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          filter: `drop-shadow(0 0 35px ${accentColor}40)`,
        }}
      />
    </div>
  );
};

import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeInOutExpo,
  easeOutBack,
  easeOutCubic,
  sequence,
  Vector2,
} from "@motion-canvas/core";
import {Circle, Grid, Line, Node, Rect, Txt, makeScene2D} from "@motion-canvas/2d";

export default makeScene2D(function* (view) {
  // Global view styling
  view.fill("#07080B");

  // 1. Grid Background
  const grid = createRef<Grid>();
  view.add(
    <Grid
      ref={grid}
      width={"100%"}
      height={"100%"}
      spacing={60}
      stroke={"rgba(96, 165, 250, 0.08)"}
      lineWidth={1}
    />
  );

  // 2. Ambient Glow
  const glow = createRef<Circle>();
  view.add(
    <Circle
      ref={glow}
      size={600}
      fill={"radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)"}
      opacity={0}
    />
  );

  // 3. Central Core Node
  const coreBox = createRef<Rect>();
  const coreTxt = createRef<Txt>();
  const subtitleTxt = createRef<Txt>();

  view.add(
    <Node>
      <Rect
        ref={coreBox}
        width={0}
        height={0}
        radius={24}
        fill={"rgba(16, 20, 28, 0.9)"}
        stroke={"#3B82F6"}
        lineWidth={2}
        shadowColor={"rgba(59, 130, 246, 0.5)"}
        shadowBlur={0}
      >
        <Txt
          ref={coreTxt}
          text={"HARNESS CORE"}
          fill={"#FFFFFF"}
          fontFamily={"JetBrains Mono, monospace"}
          fontWeight={800}
          fontSize={38}
          letterSpacing={2}
          opacity={0}
        />
      </Rect>
      <Txt
        ref={subtitleTxt}
        text={"Agent 底层执行闭环解构"}
        fill={"rgba(255, 255, 255, 0.6)"}
        fontFamily={"PingFang SC, sans-serif"}
        fontWeight={500}
        fontSize={24}
        y={80}
        opacity={0}
      />
    </Node>
  );

  // 4. Four Pipeline Nodes
  const nodeData = [
    {id: "01", title: "任务解析", sub: "INPUT", pos: new Vector2(-400, -220), color: "#06B6D4"},
    {id: "02", title: "动态规划", sub: "REASON", pos: new Vector2(400, -220), color: "#3B82F6"},
    {id: "03", title: "工具调度", sub: "EXECUTE", pos: new Vector2(400, 220), color: "#10B981"},
    {id: "04", title: "状态持久", sub: "FIBER", pos: new Vector2(-400, 220), color: "#F59E0B"},
  ];

  const nodeRefs = nodeData.map(() => createRef<Rect>());
  const linesGroup = createRef<Node>();

  view.add(<Node ref={linesGroup} />);

  nodeData.forEach((item, idx) => {
    view.add(
      <Rect
        ref={nodeRefs[idx]}
        x={0}
        y={0}
        width={300}
        height={130}
        radius={20}
        fill={"rgba(16, 20, 28, 0.88)"}
        stroke={"rgba(255, 255, 255, 0.14)"}
        lineWidth={1.5}
        opacity={0}
        scale={0}
      >
        <Txt
          text={`${item.id} • ${item.sub}`}
          fill={item.color}
          fontFamily={"JetBrains Mono, monospace"}
          fontWeight={700}
          fontSize={16}
          letterSpacing={1.5}
          y={-30}
        />
        <Txt
          text={item.title}
          fill={"#FFFFFF"}
          fontFamily={"PingFang SC, sans-serif"}
          fontWeight={700}
          fontSize={28}
          y={15}
        />
      </Rect>
    );
  });

  // 5. Signal Pulse Dot
  const signal = createRef<Circle>();
  view.add(
    <Circle
      ref={signal}
      size={24}
      fill={"#FFFFFF"}
      shadowColor={"#60A5FA"}
      shadowBlur={25}
      opacity={0}
    />
  );

  // --- ANIMATION SEQUENCE ---

  // Phase 1: Core reveal
  yield* all(
    glow().opacity(1, 0.8, easeOutCubic),
    coreBox().width(440, 0.8, easeOutBack),
    coreBox().height(100, 0.8, easeOutBack),
    coreBox().shadowBlur(40, 0.8),
    coreTxt().opacity(1, 0.6),
    subtitleTxt().opacity(1, 0.8)
  );

  yield* coreBox().scale(1.05, 0.4).to(1, 0.4);

  // Phase 2: Explode Core into 4 Nodes
  yield* all(
    coreBox().opacity(0, 0.5),
    coreTxt().opacity(0, 0.4),
    subtitleTxt().opacity(0, 0.4),
    sequence(
      0.1,
      ...nodeRefs.map((ref, idx) =>
        all(
          ref().opacity(1, 0.6),
          ref().scale(1, 0.7, easeOutBack),
          ref().position(nodeData[idx].pos, 0.7, easeInOutExpo)
        )
      )
    )
  );

  // Phase 3: Connect Nodes with Curved Lines
  const line1 = createRef<Line>();
  const line2 = createRef<Line>();
  const line3 = createRef<Line>();
  const line4 = createRef<Line>();

  linesGroup().add(
    <>
      <Line
        ref={line1}
        points={[nodeData[0].pos, nodeData[1].pos]}
        stroke={"rgba(255,255,255,0.12)"}
        lineWidth={2}
        lineDash={[8, 8]}
        end={0}
      />
      <Line
        ref={line2}
        points={[nodeData[1].pos, nodeData[2].pos]}
        stroke={"rgba(255,255,255,0.12)"}
        lineWidth={2}
        lineDash={[8, 8]}
        end={0}
      />
      <Line
        ref={line3}
        points={[nodeData[2].pos, nodeData[3].pos]}
        stroke={"rgba(255,255,255,0.12)"}
        lineWidth={2}
        lineDash={[8, 8]}
        end={0}
      />
      <Line
        ref={line4}
        points={[nodeData[3].pos, nodeData[0].pos]}
        stroke={"rgba(255,255,255,0.12)"}
        lineWidth={2}
        lineDash={[8, 8]}
        end={0}
      />
    </>
  );

  yield* all(
    line1().end(1, 0.4, easeInOutCubic),
    line2().end(1, 0.4, easeInOutCubic),
    line3().end(1, 0.4, easeInOutCubic),
    line4().end(1, 0.4, easeInOutCubic)
  );

  // Phase 4: Signal Pulse flows through all 4 nodes in a continuous loop
  signal().position(nodeData[0].pos);
  yield* signal().opacity(1, 0.2);

  // Step 1 -> Step 2
  yield* all(
    signal().position(nodeData[1].pos, 0.6, easeInOutCubic),
    nodeRefs[0]().stroke(nodeData[0].color, 0.3),
    nodeRefs[0]().shadowBlur(35, 0.3),
    nodeRefs[0]().shadowColor(nodeData[0].color, 0.3)
  );

  // Step 2 -> Step 3
  yield* all(
    signal().position(nodeData[2].pos, 0.6, easeInOutCubic),
    nodeRefs[1]().stroke(nodeData[1].color, 0.3),
    nodeRefs[1]().shadowBlur(35, 0.3),
    nodeRefs[1]().shadowColor(nodeData[1].color, 0.3)
  );

  // Step 3 -> Step 4
  yield* all(
    signal().position(nodeData[3].pos, 0.6, easeInOutCubic),
    nodeRefs[2]().stroke(nodeData[2].color, 0.3),
    nodeRefs[2]().shadowBlur(35, 0.3),
    nodeRefs[2]().shadowColor(nodeData[2].color, 0.3)
  );

  // Step 4 -> Step 1 (Loop back)
  yield* all(
    signal().position(nodeData[0].pos, 0.6, easeInOutCubic),
    nodeRefs[3]().stroke(nodeData[3].color, 0.3),
    nodeRefs[3]().shadowBlur(35, 0.3),
    nodeRefs[3]().shadowColor(nodeData[3].color, 0.3)
  );

  // Phase 5: Conclude with unified glow
  yield* all(
    ...nodeRefs.map((ref) => ref().scale(1.08, 0.4).to(1, 0.4)),
    signal().scale(2, 0.5).to(0, 0.3)
  );
});

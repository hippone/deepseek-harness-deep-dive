# DeepSeek Harness Promo

32 秒竖屏 Source-level Tech Trailer，宣传
DeepSeek Harness 固定提交源码解析。发布画面中的域名主体使用像素马赛克处理，降低社交平台 URL 识别风险。

- Composition：`DeepSeekHarnessPromo`
- 规格：1080 × 1920、30fps、960 帧
- 动画：6 个独立场景，全部由 Remotion 时间轴驱动
- 素材：网页截图、Logo 与站点事实在渲染前固化到 `public/site/`
- 音频：`scripts/generate-sfx.mjs` 生成的原创 Impact、Tick 与 Whoosh

## Commands

安装依赖：

```bash
npm i
```

刷新线上网页素材：

```bash
npm run capture-site
```

重新生成音效：

```bash
npm run generate-sfx
```

类型检查与 lint：

```bash
npm run lint
```

启动 Studio：

```bash
npx remotion studio --no-open
```

渲染成片与封面：

```bash
npm run render:promo
npm run render:poster
```

输出位置：

- `out/deepseek-harness-promo-vertical.mp4`
- `out/deepseek-harness-poster.png`

`out/` 默认不进入 Git。视频明确标注“独立技术解析，不代表 DeepSeek 官方观点”。

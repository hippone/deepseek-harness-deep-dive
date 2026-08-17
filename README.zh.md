# DeepSeek Harness 解构：可替换 Agent 运行时如何组装

[English](README.md) | 中文

对 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的源码级架构解析：它是基于 [Cordis](https://github.com/cordiverse/cordis) 的开源 Agent harness，**一切皆插件**。

本仓库是独立技术写作项目：以固定提交的上游源码为准，讲清运行时如何真正组装 —— Cordis 所有权、Profile/Bundle 产品装配、默认 Agent 执行链、会话事实、可替换能力 seam、多端产品、安全边界、证据分级与采用路线。

## 内容

- **技术决策摘要** —— 一页结论、采用决策卡、与相邻项目的定位对比（[`00-executive-brief.md`](00-executive-brief.md)）
- **目录** —— 阅读方式与章节清单（[`00-outline.md`](00-outline.md)）
- **技术解析正文** —— 四篇十二章（[`01-deep-dive.md`](01-deep-dive.md)）
- **附录 A** —— 能力地图：核心主干服务与 Definition/Provider/Consumer 全量清单（[`appendices/A-capability-map.md`](appendices/A-capability-map.md)）
- **附录 B** —— 事件与生命周期地图（[`appendices/B-event-and-lifecycle-map.md`](appendices/B-event-and-lifecycle-map.md)）
- **附录 C** —— 采用检查表：试点判断与记录表格（[`appendices/C-adoption-checklist.md`](appendices/C-adoption-checklist.md)）
- **附录 D** —— 资料与证据索引（[`appendices/D-sources-and-evidence.md`](appendices/D-sources-and-evidence.md)）

## 在线阅读

站点经 GitHub Pages 发布：<https://hippone.github.io/deepseek-harness-deep-dive/>

## 研究基线

所有实现判断绑定固定提交 `deepseek-ai/deepseek-harness@47f943859bef60e4160492346772ded9b24f765a`，行号按 `sources/` 下的本地副本核验。证据纪律：“接口存在”与“能力可运行”分开记录；官方文档只支持设计意图；采用建议单独标注为推论。完整索引见附录 D。

## 仓库结构

```text
00-executive-brief.md        技术决策摘要
00-outline.md                发布目录
01-deep-dive.md              技术解析正文（第 1—12 章）
appendices/                  A 能力地图 · B 事件与生命周期 · C 采用检查表 · D 证据索引
sources/                     固定提交的上游源码副本（gitignore，仅核验）
```

## 声明

本仓库是独立技术解析，不代表 DeepSeek 官方观点。站内鲸鱼图形取自固定提交中的官方品牌资产。

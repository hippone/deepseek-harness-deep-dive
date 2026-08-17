---
layout: default
title: 技术决策摘要
permalink: /executive-brief/
---

# DeepSeek Harness 技术决策摘要

核验日期：2026-08-14  
DSH 基线：`deepseek-ai/deepseek-harness@47f943859bef60e4160492346772ded9b24f765a`

## 一句话结论

DeepSeek Harness（下文简称 DSH）尝试解决的是更靠下的一层问题：如何把模型、工具、会话、执行环境、权限和产品入口组装成一个可以替换、撤销和检查的 Agent 运行时。相比更短的 Agent Loop，它多出的是运行时组装；相比开箱即用的 Coding Agent 产品，它的生产验证程度尚未到位。

它的增量价值只有在团队确实需要多入口、能力替换、统一会话事实或动态插件时才成立。若团队只需要在一个 Python 或 TypeScript 服务中嵌入模型—工具循环，DSH 的包、配置与 Cordis 生命周期成本很可能高于收益。

## 首轮源码判断

### 已由固定提交确认

- 默认 Agent Loop 本身是依赖 `agents`、`sessions`、`llm`、`tools` 和 `systemPrompt` 的 Cordis Service，可以随插件生命周期注册和撤销。
- 一次任务被明确拆成 Turn 与 Step；输入通过 inbox 进入，模型请求、流式块、工具调用和结束原因进入持久 SessionEvent 日志。
- 模型上下文由 `session.deriveMessages()` 从日志投影，不以另一份独立消息数组作为最终事实来源。
- Profile、Bundle 和 patch 共同形成最终插件树；Web 与 Headless 是不同装配。
- 文件系统、进程、沙箱、审批、凭据、模型和子 Agent 等能力存在独立的 Definition—Provider—Consumer 边界。

### 仍未由当前证据证明

- 开发者预览版本已经适合大规模生产部署。
- 动态可组合性一定会降低总体维护成本。
- DSH 的性能、稳定性或交付效率优于其他 Agent 项目。
- 默认组合在目标组织的安全、合规和可观察性要求下可以直接上线。

## 与相邻项目的真实位置

| 项目 | 源码显示的主要抽象 | 它更适合解决什么 | 与 DSH 的关键差异 |
| --- | --- | --- | --- |
| Codex | 产品级 `Session`、任务、轮次、工具路由和输入队列 | 直接交付编码 Agent 产品 | 产品核心集中在 Session/Turn；DSH 更强调把运行时各部分做成可替换插件 |
| Pi | 可嵌入的 `agentLoop`、状态化 `Agent` 和消息/工具回调 | 在应用中快速嵌入模型—工具循环 | DSH 增加统一持久事实、能力 seam 和产品装配；Pi 当前新 `AgentHarness` 仍有大量未实现接口 |
| OpenAI Agents SDK | `Runner`、Agent、tools、handoffs、guardrails、Session 与可恢复 RunState | 在 Python 应用里构建多 Agent 业务逻辑 | SDK 通过对象、配置和 hook 扩展；DSH 通过可卸载插件树和服务能力装配完整运行环境 |
| LangGraph | StateGraph、Pregel、channel、checkpointer 与 interrupt | 显式表达长运行、有状态工作流 | LangGraph 的主抽象是图和 superstep；DSH 的主抽象是可组合 Agent 运行时，工作流只是其中一项能力 |

这四个项目不是按“功能多少”排队。Codex 是产品，Pi 和 OpenAI Agents SDK 更接近嵌入式 Agent 构建层，LangGraph 是状态编排层，DSH 则试图覆盖运行时平台层。

## 采用决策卡

### 进入试点

同时满足以下多数条件时，值得启动隔离试点：

- 至少有两个运行入口需要共享同一会话事实，例如 Web 与 Headless/ACP。
- 模型、文件系统、进程或沙箱提供方确实需要独立替换。
- 团队需要对工具副作用、审批、凭据和恢复建立统一控制面。
- 团队愿意长期维护 Cordis 生命周期、配置树和跨包测试。

### 暂缓

- 需求方向合理，但当前版本兼容性或部署证据不足。
- 只有单入口原型，未来才可能出现平台化需求。
- 团队尚未跑通取消、恢复、权限拒绝和 provider 替换这四条关键路径。

### 不采用

- 只需要一个嵌入式模型—工具循环。
- 现有 SDK 或工作流引擎已经覆盖实际问题，DSH 只会重复抽象。
- 团队无法承担插件生命周期、沙箱与会话持久化的运行责任。
- 无法为引入 DSH 定义可测的替换收益和明确退出条件。

完整源码证据见[资料与证据索引]({{ '/appendices/sources-and-evidence/' | relative_url }})。

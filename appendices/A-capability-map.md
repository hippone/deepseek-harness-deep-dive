---
layout: default
title: 能力地图
permalink: /appendices/capability-map/
---

# 附录 A：能力地图

核验日期：2026-08-15  
DSH 基线：`deepseek-ai/deepseek-harness@47f943859bef60e4160492346772ded9b24f765a`

本附录承接第六章的全量枚举，正文只保留能支撑论点的代表性能力。三张表的服务清单、三角色分类与消费关系取自固定提交官方文档 [`docs/capability-seams.zh.md`](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/capability-seams.zh.md)（服务表位于该文件 414—471 行），并已按本地 `sources/deepseek-harness/packages` 包目录抽查核对；各能力的源码级证据见[附录 D]({{ '/appendices/sources-and-evidence/' | relative_url }})。

## 核心主干服务

文档分类为 core 的服务：拥有声明与实现的组合点本身，固定提交默认只有一种实现。

| `ctx` 键 | 所属包 | 职责 |
| --- | --- | --- |
| `ctx.sessions` | session | 拥有仅追加的 Session 实例，发出持久会话事件流 |
| `ctx.agents` | agent | 实时 Agent 句柄、创建/恢复工厂、进程本地发起方传播 |
| `ctx.agentLoop` | agent-loop | 唯一的具体循环插件（bundle 点）；扩展包依赖事件与服务，不依赖此包 |
| `ctx.agentDefaultModel` | agent-default-model | settings 分层默认 `ModelSelection`，供直接入口与 Host 入口共用 |
| `ctx.systemPrompt` | system-prompt | 每 Step 组装 prompt sections、动态 context、工具 schema 与变量 |
| `ctx.tools` | tools | 工具注册表、受监管执行流水线、Code Mode 传输 |
| `ctx.invariants` | invariants | 包归属的运行时不变式注册表：选择、唯一性、子 fiber 与失败归属 |
| `ctx.planMode` | plan-mode | 折叠已记录的计划/模式状态，注册 `/plan` 命令 |
| `ctx.goals` | goal | 从会话日志折叠带修订版本的目标状态，实时延续激活留在进程内 |
| `ctx.agentPresets` | agent-presets | preset 目录发现与 per-session 装配挂载 |
| `ctx.commands` | commands | 面向人的命令注册，不把调用发给模型 |
| `ctx.sessionProjections` | session-projection | 各领域注册状态驱动的折叠单元与水位推进 |
| `ctx.sessionProjectionCache` | session-projection-cache | 按会话持久投影检查点，冷读取阶梯 |
| `ctx.sessionReferenceResolver` | session-reference | 有界对话快照投影为持久但不可信的消息上下文 |
| `ctx.tokenMeter` | token-meter | 按会话隔离的回放折叠区，不可变且带修订版本的测量结果 |
| `ctx.toolResultPruner` | compaction-tool-result-pruner | 摘要前用可回放的单节点 surface 替换改写过大的工具结果 |
| `ctx.messageFeedback` | message-feedback | 本地逐消息反馈、逐条目 CAS；不进 Session 历史或遥测 |
| `ctx.workspaceRegistry` | workspace | 带 WorkspaceId 品牌类型的记录，稳定 sessionIds 驱动 Host RPC 与 GUI 投影 |
| `ctx.storageDomain` | storage-domain | 等待所有后端就绪后发布类型化持久状态的领域形态 |
| `ctx.typert` | typert-registry | 实时 zod 贡献注册；API 网关消费调用描述符与提供方 |
| `ctx.typertGateway` | api-gateway | 把生成的 Remote 描述符与 Cordis 服务关联，经 Connection RPC 提供一元调用 |
| `ctx.apiProxy` | apiproxy | 传输无关的 Host 网关接口，分派浏览器 API 调用 |
| `ctx.webServer` | webserver | node:http 载体：具名路由注册表、索引转换与静态回退 |
| `ctx.clientModules` | modules | `__DSH_BOOT__` 客户端入口图与插件组合包 |
| `ctx.shellEnv` | shell-env | 作用域内 `DSH_*` 事实注册表，按执行收集可信快照 |
| `ctx.sandboxPolicy` | sandbox-policy | 部署默认沙箱模式与工作区根的唯一出处 |
| `ctx.permissionPresets` | permission-presets | `workspace-write`/`danger-full-access` 预设表，一次切换写入 `permission/preset` 事件 |
| `ctx.e2b` | e2b | 共享 E2B SDK 句柄、远程工作目录与最终沙箱处置 |
| `ctx.dynamicCordisRunner` | cordis-host-runner | 内存定义注册表、Host 侧 vm 沙箱与 request-run 往返 |
| `ctx.cordisInspect` | cordis-host-runner | Host inspect 提供方、Client manifest 镜像与查询路由 |

## 可替换能力 seam 对照表

文档分类为 seam 的能力：Definition/Provider/Consumer 三角色齐全，固定提交至少一个 Provider 实现。

| 服务 | Definition | 固定提交 Provider | 主要 Consumer |
| --- | --- | --- | --- |
| `ctx.llm` | llm | llm-deepseek、llm-pi-ai、llm-replay | agent-loop、compaction-basic |
| `ctx.fs` | fs | fs-local、fs-sandbox、fs-e2b | tool-fs（配套 fs-observation-policy 事件门禁） |
| `ctx.subprocess` | subprocess | subprocess-local、subprocess-e2b | bash-local/bash-sandbox、terminal-bash、lsp-stdio、进程外 subagent 后端 |
| `ctx.shell` | shell | bash-local、bash-sandbox、pwsh-local | tool-bash、tool-pwsh、hooks-claude-code、hooks-codex |
| `ctx.sandbox` | sandbox | sandbox-local | bash-sandbox、terminal-bash |
| `ctx.codeRuntime` | code-runtime | code-runtime-worker | tools（Code Mode） |
| `ctx.terminals` | terminal | terminal-bash | tool-terminal |
| `ctx.lsp` | lsp | lsp-local | tool-lsp |
| `ctx.web` | web | web-search-exa/perplexity/deepseek、web-fetch-http | tool-web |
| `ctx.subagents` | subagent | spawn/fork-in-process、acp、codex、claude-code、dsh-sdk | tool-subagent、tool-subagent-control、tool-ralph |
| `ctx.compaction` | compaction | compaction-basic | 消费 Step 后压力事件；无面向模型的压缩工具 |
| `ctx.jobs` | jobs | jobs-local | tool-bash、tool-terminal、tool-subagent、tool-jobs |
| `ctx.workflowEngine` | workflow | workflow-worker-thread | tool-workflow、tool-ralph |
| `ctx.skills` | skill | skill-badge、skill-filesystem | tool-skill |
| `ctx.attachments` | attachment | attachment-local | host-runtime、llm-pi-ai |
| `ctx.spillStore` | spill | spill-local | spill-policy（tools/post-execute 消费方） |
| `ctx.sessionPersistence` | session-persistence | session-persistence-jsonl、session-persistence-sqlite | agent-loop、tool-bash、hooks、session-query、message-feedback |
| `ctx.sessionQuery` | session-query | session-query-sqlite | session-reference、tool-session-query |
| `ctx.sessionTitle` | session-title | session-title-first/all-prompts-llm | 确定性回退与标题折叠 |
| `ctx.sessionTelemetry` | session-telemetry | session-telemetry-otel | 无进程内消费者，输出离开进程 |
| `ctx.settings` | settings | settings-file | llm-deepseek、llm-pi-ai、apiproxy |
| `ctx.credentials` | credentials | credentials-local | llm-deepseek、llm-pi-ai、apiproxy |
| `ctx.storage` | storage | storage-json、storage-sqlite | storage-domain |
| `ctx.approval` | approval | acp（审批桥接） | tools、tool-bash |
| `ctx.userQuestions` | user-questions | UI 前端提供当前回答方 | tool-ask-user |
| `ctx.directoryPicker` | directory-picker | directory-picker-native、directory-picker-browse | apiproxy |

## 产品装配差异

三个产品 profile 在共享 base 主干上的 patch 差异（第 3 章已核验的数量与结构）：

| 装配 | bundle 序列 | 新增 | 修改/禁用 |
| --- | --- | --- | --- |
| base | 78 个 row 的共享根 | Agent 主干、会话事实、执行与控制、可选上层能力四层 | — |
| web | base → web-app | 51 个 row：Host（storage/workspace/projection/plugin inventory、web startup/server/runtime/API proxy）、Transport（modules/connection/remotes/client runtime）、Browser（conversation/tool/settings/plan/goal/jobs/subagent/trajectory/workspace/approval UI） | 27 个既有 row；进程级模型工具 row disabled 交给 agent-presets；共享模块 HMR 关闭 |
| headless | base → headless | 3 个 row：code runtime、`headless-startup`、`headless-runner` | 覆盖 system prompt 与 tools mode；关闭共享模块 HMR；不含 Host/Web/Client row |

## package 组与 ctx 服务映射

按仓库 `packages/` 分组，列出各组代表的 `ctx` 服务（包内完整路径见附录 D）：

| 包组 | 代表 ctx 服务 |
| --- | --- |
| core/ | `ctx.sessions`、`ctx.agents`、`ctx.agentLoop`、`ctx.systemPrompt`、`ctx.tools` |
| llm/ | `ctx.llm`、`ctx.tokenMeter` |
| fs/ shell/ subprocess/ sandbox/ terminal/ lsp/ e2b/ | `ctx.fs`、`ctx.shell`、`ctx.shellEnv`、`ctx.subprocess`、`ctx.sandbox`、`ctx.sandboxPolicy`、`ctx.terminals`、`ctx.lsp`、`ctx.e2b`、`ctx.codeRuntime` |
| interaction/ | `ctx.approval`、`ctx.permissionPresets`、`ctx.commands`、`ctx.userQuestions` |
| session/ session-query/ storage/ | `ctx.sessionPersistence`、`ctx.sessionTelemetry`、`ctx.sessionProjections`、`ctx.sessionProjectionCache`、`ctx.sessionTitle`、`ctx.sessionQuery`、`ctx.storage`、`ctx.storageDomain` |
| credentials/ settings/ identity/ | `ctx.credentials`、`ctx.settings`、匿名用户 id（非 Cordis 服务） |
| typert/ api/ host/ client/ | `ctx.typert`、`ctx.typertGateway`、`ctx.apiProxy`、`ctx.clientModules`、`ctx.webServer` |
| web/ attachment/ spill/ context/ | `ctx.web`、`ctx.attachments`、`ctx.spillStore`、`ctx.sessionReferenceResolver` |
| subagent/ jobs/ workflow/ skill/ compaction/ | `ctx.subagents`、`ctx.jobs`、`ctx.workflowEngine`、`ctx.skills`、`ctx.compaction`、`ctx.toolResultPruner` |
| goal/ plan/ todo/ preset/ extensions/ | `ctx.goals`、`ctx.planMode`、todo（经 `ctx.sessionProjections`）、`ctx.agentPresets`、`ctx.dynamicCordisRunner`、`ctx.cordisInspect` |

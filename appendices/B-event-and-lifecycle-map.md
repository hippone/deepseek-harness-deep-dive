---
layout: default
title: 事件与生命周期地图
permalink: /appendices/event-and-lifecycle-map/
---

# 附录 B：事件与生命周期地图

版本基线：`deepseek-ai/deepseek-harness@47f943859bef60e4160492346772ded9b24f765a`  
核验日期：2026-08-14

## 1. 三种“事件”先分层

DSH 中名为 event 的机制不只一种。能否恢复取决于事件属于哪一层。

| 层 | 代表 | 写入位置 | 默认持久化 | 主要用途 |
| --- | --- | --- | --- | --- |
| SessionEvent | `turn/start`、`assistant/message`、`tool/result` | `Session.append()` | 是，由 persistence plugin 接管 | 会话事实、重放、投影、恢复 |
| Cordis lifecycle event | `session/event`、`agent/pre-step`、`tools/execute` | `ctx.emit/on/parallel/waterfall` | 否 | 观察、包装、策略与生命周期协调 |
| 客户端/传输事件 | stream frame、WebSocket push、UI node update | Host/Gateway/client | 不一定 | 实时交付与界面状态 |

SessionEvent 被提交后，`session/event` 才通知 observer。Cordis event 本身不是 durable fact；若 listener 产生了必须恢复的模型可见变化，它还要追加相应 SessionEvent。

## 2. 核心 SessionEvent 账本

| 事件 | 典型生产者 | 是否进入模型 surface | 主要消费者 | 恢复含义 |
| --- | --- | --- | --- | --- |
| `turn/start` | Agent Loop | 否 | invariants、stats、repair | 打开一次任务尝试 |
| `turn/end` | Agent Loop；crash repair | 否 | lifecycle、stats、resume | 关闭 Turn 并记录原因 |
| `step/start` | Agent Loop | 否 | token meter、stats、repair | 打开一次模型调用及工具批次 |
| `step/end` | Agent Loop；crash repair | 否 | token meter、stats、resume | 关闭 Step |
| `user/message` | inbox intake、steer/inject、compaction checkpoint | 是 | `deriveMessages`、transcript、UI | 人类或合成的模型可见输入 |
| `assistant/chunk` | LLM stream | 否 | 流式 UI、assembler、诊断 | 原始流重放与来源证据 |
| `assistant/message` | stream assembler | 是 | `deriveMessages`、UI、token meter | 后续请求使用的完整模型输出 |
| `tool/call` | tool scheduler | 否 | repair、telemetry、stats | Harness 已记录调用开始意图 |
| `tool/result` | tool pipeline；crash repair；pruner replacement | 是 | `deriveMessages`、UI、repair | 模型可见工具结果或恢复不确定性 |
| `request/header` | request builder | 否 | resume、token meter、审计 | 实际 config、system 与 tool schemas |
| `request/context` | request builder | 否 | route/capacity 投影 | provider/model/context window 变化 |
| `todo/write` | todo tool/provider | 否 | todo projection、UI | 最新 whole-list snapshot |
| `session/end-seed` | Session 构造器 | 否 | resume、compaction lifecycle | 此位置之前是构造 seed |

插件可以通过 TypeScript declaration merging 增加事件。reader 遇到未知 required event 必须拒绝；只有带 `ignorable: true` 且确实不影响重建的事件才可跳过。

## 3. 一次 Turn/Step 的规范顺序

```text
followup / steer / inject
          │
          ▼
     inbox claim
          │
turn/start
  │
  ├─ agent/pre-step ── blocked ────────────────┐
  │                                             │
  └─ step/start                                 │
       ├─ user/message*                         │
       ├─ request/header + request/context?     │
       ├─ flush → llm/stream                    │
       ├─ assistant/chunk*                      │
       ├─ assistant/message                     │
       ├─ tool/call*                            │
       ├─ flush → top-level tool body           │
       ├─ tool/result*                          │
       └─ step/end                              │
              │                                 │
              ├─ continuation → next step       │
              └─ no work ───────────────────────┤
                                                ▼
                                           turn/end
```

`turn/start` 可以没有对应 Step：pre-step 拒绝、空输入或早期取消都可能直接关闭 Turn。正常运行中每个已打开 Step 应先关闭，再关闭 Turn。

## 4. Surface 与四种常见投影

只有 `user/message`、`assistant/message` 和 `tool/result` 能成为 surface node。

| 投影 | 输入选择 | replacement 处理 | 适合回答的问题 |
| --- | --- | --- | --- |
| 模型历史 | current surface nodes | 遮蔽被替换区间 | 下一次模型实际看到什么 |
| 用户 transcript | append-origin surface events | 保留原始对话，不把 replacement 当新对话 | 用户曾经看到什么 |
| token pressure | request header + surface + usage/估算 | 减去 shadow price，加 replacement price | 是否需要剪枝或压缩 |
| stats/telemetry | 按 unit 或策略重放事件 | 由各投影定义 | 运行发生了什么、耗时和内容如何 |

Surface replacement 必须：

1. 指向当前 surface 上实际存在的闭区间；
2. 通过 `sourceEventSeqs` 完整覆盖被遮蔽节点；
3. 以新 append-only event 表达，不能改写旧 event；
4. 让依赖位置的缓存以 replacement generation 失效并重建。

## 5. 实时提交到耐久存储

```text
Session.append()
  │  同步验证、冻结、push
  ├──────────────► session/event observers
  │                       │
  │                       ▼
  │                per-session write-behind
  │                       │ fixed bounded window
  │                       ▼
  │                 backend.appendBatch()
  │
  └─ caller continues

ctx.sessions.flush(session)
  └─ cancel window → await init → drain active/pending batches
```

| 边界 | 成功能证明 | 不能证明 |
| --- | --- | --- |
| `append()` 返回 | 进程内日志已接受不可变事件 | 磁盘已提交 |
| 后台 batch 成功 | 该 batch 已按 backend 契约耐久 | 后续事件也已耐久 |
| `flush()` 返回 `true` | 至少一个 listener 参与且全部成功 | 外部工具副作用已被补偿 |
| `flush()` 返回 `false` | 没有 durability listener 参与 | 任何磁盘持久性 |
| checkpoint 后进入 adapter/tool body | 导致动作的已提交会话前缀先落盘 | 动作与日志具备跨系统原子性 |

## 6. Crash tail 分类与修复

| 检测到的尾部 | 冷 load 行为 | 合成事件 | 自动重试建议 |
| --- | --- | --- | --- |
| 空日志或已平衡 Turn | 原样返回 | 无 | 不适用 |
| torn 最后物理记录 | 截断到有效前缀 | 视有效前缀决定 | 不因 torn fragment 推断动作 |
| assistant 中有 tool call，但无 `tool/call` | 保留完整事件 | `tool/result(TOOL_NOT_STARTED)`，再补边界 | 仍需要时可以重试 |
| 已有 `tool/call`，无 `tool/result` | 保留 call | `tool/result(TOOL_OUTCOME_UNKNOWN)`，再补边界 | 先查外部状态；非幂等操作不得盲重试 |
| open step | 保留完整 step 事实 | `step/end` | 从修复后的下一边界继续 |
| open turn | 保留完整 turn 事实 | `turn/end(interrupted)` | 新 Turn 继续 |
| committed prefix 损坏或 required event 未知 | 拒绝 load | 无 | 先修复/升级 reader，不能静默跳过 |

冷 session 可以提交 repair；仍由 live Session 拥有的 open turn 不允许被 persistence 擅自标成 interrupted。热重载 adoption 只可截断 torn 物理尾部，再让 live owner 继续提交真实后缀。

## 7. Resume、fork、compaction 对照

| 维度 | Resume | Fork | Compaction |
| --- | --- | --- | --- |
| session id | 不变 | 新 id | 不变 |
| 输入 | 冷存储完整日志 | live source 的闭合前缀 | 当前 surface 区间 |
| header 变化 | 保留原 header | 新 header 记录 parent/seed length | 不变 |
| 原事件 | 全部保留，必要时追加 repair | 作为 child seed 复制 | 原地保留 |
| 新事件 | `session/end-seed` 仅在 seed 尾部尚无 marker 时追加；后续正常运行 | `session/end-seed` 后开始 child work | start/summary/replacement/end 等新事件 |
| 拒绝条件 | 缺 persistence、live 冲突、格式/损坏、revision 不稳定 | source 非 live、boundary 无效、位于 open turn、child id 冲突 | 无可压缩区间、容量未知、摘要不缩小、活动 compaction 冲突等 |

## 8. JSONL 与 SQLite 运行检查

| 检查项 | JSONL | SQLite |
| --- | --- | --- |
| artifact 身份 | header id/cwd 必须反推同一路径；重复 id 拒绝 | session id 全库唯一，数据库带 store identity |
| lazy materialization | 首批事件与 header 一起发布 | session row 与首批 events 同事务 |
| batch 原子性 | append 失败后截回旧长度；repair 可分两步 | append 与 repair 各自在单事务中完成 |
| durability | file 与必要目录 `fsync` / Windows write-through | SQLite transaction 与配置 journal mode |
| suffix projection | 物理全扫、逻辑只返回水位后事件 | `WHERE seq >= ?` 直接 seek |
| raw export | 有单会话 artifact | 无单会话 artifact |
| writer 约束 | 同一 session 只允许一个活动 writer owner | coordinator 同样按 session 串行化 |
| retention | 无内建删除 API | 无内建删除 API |

## 9. 故障演练记录模板

| 字段 | 记录内容 |
| --- | --- |
| session / backend | id、cwd、JSONL 或 SQLite、配置摘要 |
| crash 注入点 | 模型请求前、tool body 前、tool body 后、result flush 前等 |
| crash 前水位 | 最后成功 flush seq、revision、最后平衡 Turn |
| 物理尾部 | torn marker、最后完整 event、artifact/row 状态 |
| inspect 结果 | 是否仅内存补 closer、视图末尾事件 |
| load 结果 | repair 是否提交、revision 是否改变、是否重新读取 |
| 工具不确定性 | callId、错误码、外部状态核验方式与结果 |
| resume 结果 | 首个新 request header、derived message 数、首个新 event seq |
| fork 验证 | parent id、boundary、seedLength、child 首个 live event |
| 未恢复信息 | inbox、process memory、credential、外部事务等 |

该模板记录的是可验证事实。Agent 在恢复后说“任务已经完成”不能替代文件 diff、测试结果、第三方 API 状态或其他业务完成证据。

## 10. Cordis 插件、依赖与热替换速查

### 10.1 Fiber 状态与依赖重载

```text
apply Plugin
    │
    ▼
 PENDING ── 必需 Service 可用 ──► LOADING ── 成功 ──► ACTIVE
    ▲                                  │                    │
    │                                  └─ 异常 ──► FAILED  │
    │                                                       │
    └─ 依赖仍缺失 ◄── UNLOADING ◄── provider 消失/更换 ────┘
                              │
                              ├─ 新依赖满足 → 再次 LOADING
                              └─ Fiber 被撤销 → DISPOSED
```

| 检查点 | 运行时语义 | 插件作者责任 |
| --- | --- | --- |
| Plugin 注册 | 创建 Fiber，不保证立即执行插件体 | 不依赖配置行顺序完成服务启动 |
| inject 未满足 | Fiber 保持 pending | 把必需能力声明为 inject，不在模块全局轮询 |
| provider 身份变化 | consumer 先卸载，再按新 epoch 重载 | 插件体允许多次执行，不遗留旧 listener/任务 |
| Service 撤销 | 更新并等待 dependents 收敛，再移除 provider 自身访问 | disposer 中完成仍需使用 provider 的清理 |
| Fiber dispose | 撤销已登记 effects 和子实例 | 外部副作用与未登记任务另行收敛或补偿 |

### 10.2 Effect 撤销顺序

```text
单个 effect 内： disposer C → disposer B → disposer A
Fiber 顶层 effects：逆序取出后并发等待，不保证 effect 间串行完成
```

严格顺序应放在同一个 effect：按“最后登记、最先撤销”排列。`ctx.on()`、Service 注册和子插件应用会自动归属 Fiber；自建 watcher、timer、process、socket 和 detached Promise 必须显式登记。

### 10.3 事件模式选择

| 需要 | 应选模式 | 关键检查 |
| --- | --- | --- |
| 同步通知多个 observer | `emit` | Promise 不被等待；同步异常是否由生产者隔离 |
| 取得第一个同步决定 | `bail` | `0`、空字符串也会短路；调用方如何解释返回值 |
| 按序等待 listener | `serial` | 首个 bail 值同样终止后续调用 |
| 允许插件包装、接管或委托默认行为 | `waterfall` | `next()` 是否恰好调用一次；不调用是否有意短路 |

### 10.4 配置刷新与模块 HMR 边界

| 能力 | 管理对象 | 可以证明 | 不能证明 |
| --- | --- | --- | --- |
| patch 配置刷新 | EntryTree、entry config、Fiber | 候选树失败时尝试恢复旧树；entry 替换等待旧 Fiber dispose | 外部写入回滚、插件私有内存迁移、回滚必然成功 |
| 局部模块 HMR | 插件入口、模块缓存、Registry/Fiber | 先验证新模块可导入；失败时恢复缓存并尝试重建旧插件 | 新旧实例绝无异步重叠、未纳管任务停止、框架依赖原地替换 |
| 完整重载 | 整个进程 | 重新建立全部进程内状态 | 自动恢复未持久化状态或补偿外部副作用 |

Web 与 Headless 的固定配置关闭局部模块 HMR，但仍可用 watch-only 模式刷新用户 patch。排障时先确认发生的是“配置树重组”还是“代码模块替换”，不要只看日志里都出现了 HMR 字样。

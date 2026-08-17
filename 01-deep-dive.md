---
layout: default
title: 技术解析正文
permalink: /deep-dive/
---

# DeepSeek Harness 解构：可替换 Agent 运行时如何组装

核验日期：2026-08-14

## 阅读说明

本文按问题组织，不按 package 顺序复述源码。全文围绕一个问题展开：当 Agent 从“调用一次模型”发展为能读写文件、启动进程、暂停审批、恢复会话并服务多个入口的系统时，运行时应该由什么组成，哪些状态必须成为事实，哪些能力应该允许替换？

所有实现判断都绑定到固定提交。源码里存在类型或接口不代表能力已经可用；README 里的设计目标也不自动成为运行证据。

# 第一篇 为什么这样组装

## 第一章 从最小 Agent Loop 到 Agent 运行时

### 1.1 从最小 Agent Loop 开始

一个最小 Agent 通常只需要四步：

1. 把用户消息和历史消息发送给模型。
2. 如果模型返回工具调用，执行工具。
3. 把工具结果追加到消息数组。
4. 再次请求模型，直到模型返回普通回答。

Pi 的低层 `agentLoop` 基本呈现了这条直接路径。它维护 `currentContext.messages`，流式取得 assistant message，筛出 tool calls，执行后把 tool results 放回上下文；steering 和 follow-up 通过两个回调队列进入下一轮。这是一种清晰、可嵌入、容易修改的 Agent Core。

问题不在这个循环“太简单”。当循环开始承担产品平台职责时，以下几类耦合压力是这类系统的常见形态（以下为本文的归纳）：

- 模型选择和重试写进循环，换模型要改主路径。
- 文件、Shell、沙箱和审批互相调用，安全策略散落在工具实现里。
- UI、CLI 和 SDK 各自维护会话状态，恢复结果不一致。
- 新增压缩、子 Agent 或后台任务时，只能继续给核心循环加分支。
- 进程取消、插件卸载和热更新没有共同的资源归属模型。

这些问题并非每个 Agent 都会遇到。只做单入口、单执行环境的应用时，直接循环反而更容易维护。按本文的框架，DSH 的架构选择回应的是另一类系统的压力：团队准备长期维护多个 Agent 产品形态，并希望模型、工具、执行世界和会话事实独立演进。

### 1.2 DSH 把循环变为一种可替换实现

在固定提交中，`AgentLoop` 是一个 Cordis `Service`，显式依赖 `agents`、`sessions`、`llm`、`tools` 和 `systemPrompt`。Agent 的创建由 factory 完成，具体驱动器随插件生命周期注册和撤销。这和“应用启动后进入一个不可替换的 while loop”是不同的所有权关系。

默认驱动器仍然包含循环，但循环不再拥有所有能力：

- `ctx.llm` 负责模型适配器与流式协议。
- `ctx.tools` 负责工具注册和带 guard 的执行流水线。
- `ctx.sessions` 负责追加式会话事实。
- `ctx.systemPrompt` 在每个 Step 组装提示片段和工具 schema。
- `agent/*` 与 `tools/*` waterfall 允许插件观察、包装、拒绝或替换行为。

因此 DSH 所说的“可替换”改变的是能力的注册、消费与撤销方式，与给类增加构造参数无关。它的代价也来自这里：开发者必须理解 Cordis Context、Fiber、Effect、Service、依赖激活和 disposer，配置错误也可能跨越多个包才显现。

### 1.3 Turn、Step 与持久事实

DSH 把一次用户层任务分成 Turn 与 Step。Turn 在领取第一批输入前打开；一个 Step 包含一次模型请求及其工具调用。工具结果、steer 或注入上下文可能要求同一 Turn 继续下一个 Step。

关键点在记录边界。默认驱动器依次追加：

```text
turn/start
  step/start
  user/message*
  request/header 或 request/context
  assistant/chunk*
  assistant/message
  tool/call* → tool/result*
  step/end
turn/end
```

模型请求的 messages 由 `session.deriveMessages()` 生成。请求真正使用的 provider、model、system prompt 和 tools 也会进入 request header。这样，恢复、UI 投影和下一次模型请求可以围绕同一组事实工作，无需各自维护一份“差不多相同”的状态。

这比普通消息数组解决了更多问题，也引入了更严格的写入纪律：任何模型可见的新信息都必须能从日志重建；实时控制事件和持久事实不能混用；日志 schema、投影和恢复策略成为兼容性表面。

### 1.4 本章结论

DSH 的增量价值在于让 Agent Loop 成为运行时中可注册、可替换的组件，并让会话成为多个入口共享的事实来源；它并不追求把模型或工具调用写得更短。

这个价值只有在“替换能力、恢复事实、多入口组装”是实际需求时才成立。对于一个只需要嵌入式循环的服务，Pi 或 OpenAI Agents SDK 一类更窄的抽象可能更合适；对于显式长流程编排，LangGraph 的图和 checkpoint 才是需要优先评估的主抽象。

## 第二章 读懂 DSH 所需的 Cordis 核心

Cordis 在 DSH 中承担运行时的所有权骨架职责，作用范围超出外围插件库。它决定插件何时执行、资源归谁撤销、服务变化如何传播，以及配置变更最终替换哪一段运行实例。

本章只讲读懂 DSH 必需的五组概念，不展开完整 API。判断一段插件代码时，始终追问四件事：谁创建它，谁持有它，什么变化会让它重新执行，撤销完成能证明到哪一步。

### 2.1 Context / Plugin / Fiber：定义、作用域与运行实例

这三个词不能互换：

| 概念 | 在运行时中的角色 | 最接近的后端类比 | 类比失效之处 |
| --- | --- | --- | --- |
| Context | 带作用域的服务访问入口，也是注册 listener、effect 和子插件的入口 | 依赖注入容器的子作用域 | 它同时携带当前 Fiber 与事件过滤语义，不只是一个对象表 |
| Plugin | 可执行的定义，可以是函数、类或带 `apply` 的对象 | 模块工厂 | 同一个 Plugin 定义可以产生多个运行实例 |
| Fiber | 一次 Plugin 应用的运行实例，持有 config、依赖快照、子 Context 和 effects | 受监管的进程或组件实例 | 它不是线程；这里的并发和调度仍由 JavaScript 事件循环承担 |

关系可以先记成：

```text
parent Context
  └─ apply Plugin(config)
       └─ Fiber
            ├─ child Context
            ├─ resolved dependencies
            ├─ effects / disposers
            └─ child Fibers
```

`Context.extend()` 生成原型继承的子 Context；注册插件时，Cordis 再为该 Fiber 建立携带 `fiber` 的子 Context。插件体中拿到的 `ctx` 因而是当前运行实例的能力视图，作用域限定在该 Fiber。

Fiber 有 `PENDING`、`LOADING`、`ACTIVE`、`FAILED`、`UNLOADING` 和 `DISPOSED` 等状态。注册插件不等于插件体已经执行：必需依赖尚未出现时，它停在 pending；依赖满足后才加载。依赖的 provider 消失或换成另一个 Fiber 时，consumer 会卸载，并在条件恢复后再次执行插件体。

因此，插件体是一段可能多次进入、每次都必须能够完整退出的生命周期程序。凡是依靠模块全局变量暗中保存运行实例状态的实现，都会绕过这层所有权。

### 2.2 Effect / disposer：把资源绑回插件生命周期

Effect 表达“立即建立一组副作用，并登记如何撤销”。事件监听、Service 注册和子插件应用都通过 Effect 自动归属当前 Fiber；文件 watcher、定时器、子进程、socket 等自建资源，也应显式接入同一条撤销链。

一个典型写法是：

```ts
ctx.effect(function* () {
  const controller = new AbortController()
  const worker = startWorker({ signal: controller.signal })

  yield () => worker.whenIdle()
  yield () => controller.abort()
})
```

同一个 effect 内，disposer 按登记的逆序执行；这允许代码把“先停止接收，再等待收敛，最后释放底层句柄”写成一组明确的 teardown。需要注意，Fiber 卸载顶层 effects 时会把逆序列表交给 `Promise.all`，不同 effect 之间没有串行完成保证。若两个撤销动作存在严格先后关系，应把它们放进同一个 effect，注册顺序不提供这种保证。

disposer 可以异步，重复调用会成为空操作，但这不意味着 Cordis 能自动取消任意异步任务。插件必须自己保留 AbortController、进程句柄或 drain Promise，并在 disposer 中发出停止信号、等待任务真正退出。否则“listener 已撤销”不等于“它启动的后台工作已经停止”，更不等于外部副作用已经补偿。

### 2.3 Service / inject：依赖变化会重跑 consumer

Service 是挂在 Context 名称空间上的能力；`inject` 是插件对这些能力的依赖声明。它的作用不只是决定启动顺序，还建立 provider 与 consumer Fiber 之间的动态关系。

```text
provider ACTIVE
  └─ service 可见 → consumer 满足 inject → consumer ACTIVE

provider 消失或身份变化
  └─ consumer UNLOAD → 撤销 effects
       └─ 新 provider ACTIVE → consumer 重新执行
```

直接读取 `ctx.someService` 时，Cordis 会检查当前插件是否声明了相应 inject，并拒绝访问非 active provider。`ctx.get('someService')` 则是显式的可选探测，不要求 inject，默认也只返回 active 实现。两者不能混用：前者表达稳定依赖，后者表达“现在有就用”的运行时查询。

Service 注册本身也是一个 effect。provider 撤销时，Cordis 先让依赖它的 consumer 更新并等待这些 Fiber 收敛，再移除 provider 自身的访问权。这使“consumer 的 disposer 仍能完成清理”成为可实现的顺序，但不能替插件保证外部资源一定配合退出。

依赖是否变化由 provider Fiber 身份形成的 epoch 判断，与同名属性是否仍然存在无关。因此同名服务被另一实例接管，也会触发 consumer 重载。配置行的先后顺序不能代替 inject；Loader 可以先看见 consumer，让它 pending，等 provider 可用后再激活。

### 2.4 Cordis 事件：通知、短路与委托的语义差异

DSH 用同一套事件系统同时承载观察通知和可组合控制点。调用端读取事件时，dispatch 模式决定等待语义、顺序与短路行为：

| 模式 | 是否等待 Promise | listener 顺序 | 返回值与短路 | 适用语义 |
| --- | --- | --- | --- | --- |
| `emit` | 否 | 同步依次调用 | 忽略返回值；同步抛错会终止本次分发 | 进程内观察通知 |
| `bail` | 否 | 同步依次调用 | 首个非 `null`、非 `undefined`、非 `false` 的值立即返回 | 同步问询或拦截 |
| `serial` | 是 | 逐个等待 | 同样在首个 bail 值处停止 | 必须按序完成的异步协调 |
| `waterfall` | 返回组合链，由调用方负责 `await` | 中间件嵌套 | 调用 `next()` 才委托后续；不调用即截断 | 包装、替换或接管一段行为 |

这里有三个容易写错的边界。

第一，`emit` 不自动隔离异常。它不等待 listener 返回的 Promise，异步拒绝不会成为 emit 的完成条件；同步 listener 抛错则会直接打断分发。DSH 某些生产者会自行捕获 observer 失败，那是生产者额外建立的边界，不能推广成所有 emit 的保证。

第二，Cordis 的 bail 判断与 JavaScript truthy 判断不同。`0` 和空字符串也会短路，只有 `null`、`undefined` 与 `false` 表示继续。调用方还可能对结果做更窄的解释，例如 UI trigger 虽然使用 `bail`，最终只把严格等于 `true` 视为“已处理”。因此既要读 dispatcher，也要读返回值消费者。

第三，waterfall 的 `next` 是委托权：

```ts
ctx.on('agent/request-error', async (error, next) => {
  if (isRetryable(error)) return { retry: true } // 当前插件接管恢复
  return next()                                  // 委托给后续插件或默认行为
})
```

listener 可以在 `next()` 前后加入逻辑，也可以完全不调用它来短路后续链。`agent/pre-step` 用这种方式让插件包装或拒绝进入 Step；`agent/request-error` 用它区分“我决定重试”和“交给下游处理”。框架没有把 `next()` 强制限制为只能调用一次，插件作者仍应把它当作单次 continuation，否则后续副作用可能重复执行。

事件 listener 也是 effect，插件卸载时会自动撤销。这只解决“以后不再接收事件”，不自动等待 listener 私自启动且未纳入 effect 的后台任务。

### 2.5 配置组合与 HMR：插件树级替换

DSH 启动时先得到空配置，再按固定层次组合为有效配置树：

```text
bundle patches
  → profile patch
  → home user patch
  → CLI overlays
  → telemetry hard-disable overlay
```

配置项以稳定 id 定位。后层命中同一 id 时，替换该行的整个 `config`，不做递归深合并；因此 profile 若只写一个字段，不能假定 base 行的其他字段仍会保留。行在文件中的位置同样不决定插件激活顺序，真正的激活由 inject 和服务可用性驱动。

Loader 把有效配置转换成 EntryTree，并区分三类变化：

| 变化 | 实际动作 | 失败后的处理 |
| --- | --- | --- |
| 同一 entry 的 config 变化 | 调用对应 Fiber 的 update；插件可通过内部 update waterfall 接管，否则卸载再加载 | 尝试恢复旧 config |
| entry 名称、inject 或分组变化 | 先准备新 entry（仅名称变化时重新导入候选模块，inject/分组变化复用原 callback），等待旧 Fiber dispose，再启动新 entry | 尝试用旧配置重建；回滚失败会汇总报错 |
| 模块文件变化 | HMR 分析插件入口及依赖，清缓存并重新导入，再删除旧插件实例、创建新 Fiber | 导入或加载失败时恢复模块缓存，并尽力重新注册旧插件 |

Include 配置刷新会重新读取 patch，构造候选树，再事务式更新当前树。组更新会收集各 entry 的结果；任何一项失败时，撤销本轮新增项并重建旧配置。这里的“事务”只覆盖 Loader 能管理的插件树和模块缓存，与数据库事务、外部世界的回滚协议无关。

可以依赖的保证包括：配置刷新按代际串行化；同 id 配置可回退到上一棵已知树；配置 entry 替换会等待旧 Fiber 的 `dispose()`；插件重新执行时，其 effect 链会参与撤销。

不能依赖的保证包括：

- 插件内存状态自动迁移到新实例；需要保留的状态必须外置或显式接管 update。
- 已发送的网络请求、已写入的外部系统或已启动却未纳管的任务自动回滚。
- 任意模块热替换都严格等待所有异步 disposer 完成。部分模块 HMR 通过 registry 删除旧插件，而 registry 的删除路径并不等待每个 `fiber.dispose()` 后才创建新 Fiber，因此不能把它当成强隔离切换。
- 框架自身或不支持局部分析的外部依赖变化可以原地热替换；这类变化会要求完整进程重载。
- 回滚永远成功。旧插件本身若已无法重新加载，Loader 只能报告复合失败。

固定提交中的 Web 与 Headless profile 明确关闭共享的模块 HMR，因为该生命周期尚未被这两个产品面验证；启动器仍可挂载 watch-only HMR，只监听用户 patch 并执行配置树刷新。实际部署时应把“配置可热重组”和“代码可原地热替换”作为两项独立能力验证。

### 2.6 本章结论

读 DSH 插件时，可以按一条固定链路检查：Plugin 定义由哪个 Context 应用，产生哪个 Fiber；Fiber 依赖哪些 Service；每项副作用进入哪个 effect；事件是通知、短路还是委托；配置或 provider 改变后，旧实例如何撤销、新实例如何恢复。

Cordis 给出的核心能力是把运行实例、依赖变化与资源撤销放进同一所有权模型；插件数量本身不构成能力。它能管理被声明和登记的进程内资源，却不能替插件迁移私有状态、补偿外部副作用，或把所有 HMR 变成原子事务。后续章节讨论 DSH 的 Agent、Session、工具与入口时，都会沿用这条边界。

## 第三章 Profile、Bundle 与可检查的产品组装

第二章回答了配置树如何更新，这一章回答更具体的问题：运行 `dsh --profile web` 或 `dsh --profile headless` 时，最终到底装了什么？

在 DSH 中，产品是“一组有顺序的 bundle patch + 用户 patch + 启动器事实”形成的有效插件树；入口文件只是这组装配的起点。这个设计让 Web 与 Headless 复用同一运行时主干，也把配置审计变成部署责任：只看 base 配置、某个 profile 文件或 package.json，都看不到完整产品。

### 3.1 从空根配置开始

首次使用时，Web profile 的 bundle 顺序是：

```text
@deepseek-ai/dsh-base
  → @deepseek-ai/dsh-web-app
```

Headless 则是：

```text
@deepseek-ai/dsh-base
  → @deepseek-ai/dsh-headless
```

每个 profile 目录中的 `cordis.yml` 都会被启动器重写为空数组。它只作为 Loader 所需的真实 include 根和相对路径锚点，最终配置由后续各层覆盖形成。有效树按以下顺序覆盖到这个空根上：

```text
bundle patches（package.json 中的顺序）
  → profile/cordis.patch.yml
  → $DSH_HOME/cordis.patch.yml
  → --patch overlay（参数顺序）
  → 启动器装配补丁
  → telemetry hard-disable
```

启动器装配补丁目前包括 Web agent preset 的只读 shipped root；`DSH_TELEMETRY_DISABLED` 非空时，最后再把 telemetry row 设为 disabled。这里的“最后”具有安全含义：用户 profile 或命令行 overlay 不能在它之后重新打开遥测。

后层通过稳定 id 修改前层 row。第二章已经说明，命中 `config` 时替换的是整段 config，不做深合并。第三章更关心它对产品配置的后果。例如：

```yaml
# base
- id: agent-loop
  config:
    agents: []

# profile patch
- id: agent-loop
  config:
    agents:
      - id: worker
        provider: custom
        model: model-a
```

profile 层用新 config 整体替换 base config；“在空 agents 后追加 worker”的读法在这里不成立。若某 row 原来还有其他字段，后层必须完整重述自己希望保留的值。

配置文件中的行顺序仍不决定加载顺序。Loader 可以先创建一个 consumer Fiber，让它等待 inject；provider 可用后再激活。产品装配关注的是“有哪些 row、各自最终配置是什么”，运行时激活仍由第二章的服务依赖模型决定。

### 3.2 base 是共享运行主干，能力默认未全部启用

固定提交的 base patch 一次插入 78 个 row。这个数字只描述组合规模，不能证明 78 项能力都在运行。base 内部至少有四层职责：

| 层 | 代表 row | 在贯穿任务中的作用 |
| --- | --- | --- |
| Agent 主干 | `agent`、`agent-loop`、`llm`、`tools`、`system-prompt` | 创建 Agent，组装请求，执行模型—工具循环 |
| 会话事实 | `session`、JSONL persistence、projection、checkpoint、attachment | 记录事件、持久化、投影与动作前耐久屏障 |
| 执行与控制 | subprocess、sandbox policy、approval、filesystem/shell tools、timeout | 把模型工具调用约束到具体执行世界 |
| 可选上层能力 | goal、plan、compaction、jobs、subagent、workflow、skills、web search | 为 Agent 增加长任务、上下文和协作能力 |

同一棵 base 树里存在几种不同的“未运行”：

- 平台条件禁用：Bash 与 PowerShell row 根据操作系统二选一。
- 服务已挂载但功能休眠：pi-ai adapter 没有 settings provider profile 时不注册额外模型路由。
- 查询接口存在但能力关闭：session query 的 `openAt: never` 保留精确读取能力，却不开启全文索引。
- telemetry row 存在但 mode 默认是 `DISABLED`；额外的环境开关还能直接禁用整个 row。
- `agent-loop` 的 `agents` 默认是空数组，base 本身不会因为插件很多就在启动时创建一个 Agent。

因此，审计 base 不能把 row 存在、Fiber active、provider 有路由、Agent 实际可见四种状态合并成“功能已启用”。审计需要从贯穿任务反推最小子树。例如一次 Headless 文件修复至少会经过：

```text
headless runner
  └─ agents / sessions / agentDefaultModel
       └─ Agent Loop
            ├─ llm adapter + credentials/settings
            ├─ system prompt
            ├─ tools
            │    ├─ approval / permission / timeout
            │    └─ filesystem / shell / subprocess / sandbox
            └─ session persistence + checkpoint
```

goal、workflow、subagent 或 Web UI 是否也在树中，与这条最小任务链能否成立是两个问题。

### 3.3 Web 增加的是 Host、传输和浏览器控制面

Web patch 在 78 个 base row 上新增 51 个 row，并修改或禁用 27 个既有 row。新增内容按三层产品能力组织，没有第二套 Agent Core：

```text
Host plane
  storage / workspace / projection cache / plugin inventory
  web startup / web server / web runtime / API proxy

Transport plane
  modules / connection / API remotes / client runtime

Browser plane
  conversation / tool / settings / plan / goal / jobs
  subagent / trajectory / workspace / approval UI ...
```

启动参数也没有被 CLI 启动器直接塞进 Web server。`web-startup` 注入 `cmdlineArgs`，解析 `--host`、`--port` 和 `--trusted-host`，再提供 `webStartup` Service。`webserver` 与 `web-runtime` row 注入该服务后才求值配置；Web server 绑定后，runtime 再提供带实际绑定信息的 `webRuntime`，connection 才能取得 trust fence 所需的 authorities。

这条依赖链说明 `!!js ctx.webStartup.port` 的求值要等 entry 的 inject 满足后，在该 Fiber 的 Context 中进行；把它提前当静态 YAML 解析，会错过真实配置来源和失败时点。

Web 还改变了 Agent 能力的归属。base 中许多模型可见工具和 prompt contribution 是进程级 row；Web 将 Bash、文件、plan、compaction、subagent、workflow、todo、web search 等 row 显式 disabled，再由 `agent-presets` 为每个会话装配相应的 Agent plane。与此同时，jobs、goals、token meter 和 subagent registry 等跨会话或 Host remote 需要访问的服务仍留在 Host plane。

所以“Web = base + UI”仍然过于简单。更准确的说法是：Web 保留共享服务主干，增加 Host/Client 两端，并把部分模型可见能力从进程级组合迁到 per-agent preset。若只看新增的 UI row，会漏掉这次所有权迁移。

与 Web 相关的三条更新路径也应分开：共享模块 HMR row 被明确关闭；`client-hmr` 只在外部 Web rebuild watcher 产生新 bundle 时接收客户端插件更新；启动器另外可以创建 root 为空的 watch-only HMR 来刷新用户 patch。这三条路径不能合并成“Web 支持热更新”。

### 3.4 Headless 只增加一次性驱动器

Headless patch 只新增三个 row：code runtime、`headless-startup` 和 `headless-runner`；它同时覆盖 system prompt、tools mode，并关闭共享模块 HMR。它没有插入 Host、HTTP server、Web runtime 或任何 browser client row。

其启动链是：

```text
launcher provides cmdlineArgs + appExit
  → headless-startup parses task
  → provides headlessStartup
  → headless-runner config reads ctx.headlessStartup.task
  → runner awaits Loader settlement
  → creates fresh Agent/Session
  → followup(task) → whenIdle()
  → sessions.flush()
  → read final assistant/message + turn/end
  → stdout + bounded appExit
```

这里有三个值得保留的实现边界。

第一，runner 在创建 Agent 前等待整棵 Loader tree settle，避免 sibling adapter 或工具 row 仍在加载时就开始第一轮模型请求。配置行顺序不提供这个保证，显式 settlement 才提供。

第二，stdout 不直接转发模型流。runner 等待 Agent idle 和 Session flush，再从本次区间的 SessionEvent 中提取最后一条 assistant text 与 `turn/end` reason；只有 completed 才请求退出码 0。它仍不证明工具声称的外部任务已经正确完成，外部结果必须按第九章的方法复核。

第三，固定 Headless runner 每次创建一个带随机 id 的新 Session。DSH 核心支持 resume，不等于这个一次性产品入口已经把 resume 暴露为自己的命令行语义。产品能力必须沿实际入口核验，不能从底层 Service 反推。

Headless 和 Web 因而共享 Agent、Session、LLM、Tools 等契约与事件语义，但两者是独立的 live runtime。两个独立进程不会天然共享 inbox、AbortController、活动 Agent 或 UI 状态；是否读到同一会话，还取决于它们是否指向同一持久化后端并遵守 writer ownership。

### 3.5 `--dump-config` 能审计什么、遗漏什么

DSH 提供两种不启动应用的配置输出：

| 命令 | 包含内容 | 适合用途 |
| --- | --- | --- |
| `--dump-default-config` | bundle layers | 用户 patch 损坏时查看出厂组合；比较 Web/Headless 基线 |
| `--dump-config` | bundle + profile patch + home patch + `--patch` overlays | 检查用户层和临时 overlay 的最终覆盖结果 |

dump 使用与 boot 相同的 `applyEntryPatches` 算法，并在连续 row 前输出来源注释；被后层修改的 row 会标出 `patched by`。命中不存在 id 的 patch 会产生 warning。固定提交的 built-bin 测试还明确断言：Web dump 包含 agent-loop 与 host webserver；Headless dump 包含 headless runner，且不含 `dsh-host-*`、Web app 和 `dsh-client-*`；命令行 overlay 会覆盖 profile layer，并在来源注释中保留两层顺序。

把两个默认 dump 放在一起，最关键的结构差异应呈现为：

| 关键 row | Web | Headless |
| --- | --- | --- |
| `webserver` / `web-runtime` / `connection` | 新增 | 不存在 |
| `client-runtime` 与 UI roster | 新增 | 不存在 |
| `agent-presets` | 新增，按会话组装 Agent plane | 不存在 |
| `headless-startup` / `headless-runner` | 不存在 | 新增 |
| base `tool-fs` 等模型工具 | 进程级 row disabled，交给 preset | 沿用 base 的进程级组合 |
| 共享模块 `hmr` | disabled | disabled |

但 dump 只能证明“当前进程最终运行状态”的一部分：

- 它不启动 Fiber，也不求值 `!!js`，因此看不到当前 OS、cwd、环境变量和 injected Service 解析后的值。
- CLI dump 组合 bundle、profile、home 和显式 overlays，但没有加入 live boot 中的 shipped agent-preset root 补丁与 telemetry hard-disable 补丁。
- 它能证明 row 结构和来源，不能证明 provider 已 active、外部依赖可用、Web 已绑定或 Agent 已创建。
- `--dump-default-config` 故意不解析 profile user layer、home layer 和 `--patch`，适合恢复诊断，不构成用户最终配置。

因此更可靠的配置审计分两步：先 dump 并 diff 结构，再启动目标入口观察运行态。

```text
1. 保存 --dump-default-config
2. 保存 --dump-config 与所有 warning
3. diff 关键 row，检查整段 config 是否误丢字段
4. 标注 launcher-only patch 与 !!js 运行条件
5. 从 consumer 反查 inject/provider
6. 启动后核对 active Fiber、实际 provider/model、bind 地址和失败日志
```

一次完整的配置审计至少覆盖 `agent-loop`、`llm-deepseek`/替代 adapter、credentials、session persistence、checkpoint、sandbox policy、approval、filesystem/shell tools，以及具体入口 runner。包已经安装或 row 出现在 dump 中，都不能替代这一步。

### 3.6 本章结论

Profile 与 Bundle 的价值是让同一运行时主干生成不同产品，同时保留 row 级覆盖和来源审计；拆成更多文件只是实现方式。它的代价也很具体：最终行为分散在 bundle 顺序、用户层、启动器补丁、配置表达式、inject 和运行环境中，任何一处都可能改变有效树。

要回答“Web/Headless 当前装了什么”，需要四类证据合并：共享主干、入口专属能力和显式关闭项构成的产品树结构，row 级变更半径的审批记录，dump 看不到的环境、凭据、路径和 bind 事实，以及从 row 追到 Plugin、Fiber、inject 与实际 Service 的实现追踪。缺任何一类，“当前装了什么”都只是部分答案。

# 第二篇 一次任务如何运行

## 第四章 从输入到 idle：默认 Agent 执行链

### 4.1 Agent 的运行区间：从唤醒到再次 idle

DSH 的 Agent 对外暴露 `followup()`、`steer()`、`inject()`、`cancel()` 和 `whenIdle()`，但它没有把一次用户消息包装成一个“返回这次回答”的请求对象。

三类输入进入同一个 inbox，却有不同目标：

- `followup` 写入 `next-turn` 并唤醒驱动器；
- `steer` 写入 `next-step` 并唤醒驱动器；
- `inject` 写入 `next-step`，但不会单独唤醒 Agent。

驱动器从 idle 进入 running 后，会连续排空它所拥有的工作。运行期间加入的 steering、排队 follow-up 或工具生成的 additional context，可能共享同一个 running 区间。因此 `whenIdle()` 只承诺整个 Agent 再次稳定，不证明某一条 `followup` 与某一段 assistant 输出存在一一因果关系。

这对后端开发者是一个容易误判的地方。它不像普通 HTTP 请求的 `request -> response`，更像一个带邮箱的 actor 或长寿命 worker：消息回执、工作区间和最终空闲是三个不同边界。自动化入口如果需要“一次 run”的结果，必须自行定义从哪一条持久 inbox 事实开始，到哪个完整 idle 结束，并明确区间内可能包含其他输入。

### 4.2 Turn 在领取输入前打开

默认驱动器的 `kick()` 持续调用 `turn()`，直到没有待处理工作。每个 Turn 的顺序是：

1. 先追加 `turn/start`。
2. 从指定 inbox target 领取消息。
3. 组装 system prompt、工具 schema 和运行时上下文。
4. 运行 `agent/pre-step` waterfall。
5. 若允许进入，追加 `step/start` 和模型可见的 `user/message`。
6. 执行模型请求与工具批次。
7. 追加 `step/end`。
8. 当没有工具 continuation 或 next-step 输入时运行 `agent/turn-stopping`。
9. 无论成功、阻断、取消或错误，最终追加 `turn/end`。

Turn 在领取第一批输入之前就已打开，所以即使首批输入被插件拒绝、被改写为空，日志仍能记录“一次尝试发生过但没有花费模型 Step”。这比只记录成功消息多出一个审计能力：阻断、空输入和取消不会悄悄消失。

`agent/pre-step` 是模型可见输入的准入点。它可以拒绝整个 Step，也可以替换已领取消息；系统 prompt 组装出的运行时上下文同样在这里进入。插件若要新增模型可见事实，不能只改临时数组，还必须让它进入可恢复的 SessionEvent 表面。

### 4.3 一个 Step 如何形成请求

进入 Step 后，驱动器调用 `buildRequest()`：

- 从上一次 `request/header` 恢复仍适用于当前 route 的显式配置；
- 通过 `agent/request` waterfall 提议 provider、model、reasoning 和采样参数；
- 让 `ctx.llm.prepareCall()` 解析精确模型和 adapter 默认值；
- 将生效的 config、system prompt 与 tool schema 写入 `request/header`；
- 将 provider、model 和 context window 变化写入 `request/context`；
- 用 `session.deriveMessages()` 得到边界消息，构造冻结的模型请求。

这样记录的是本次请求真正解析出的配置，未必等于“用户配置想用什么”。切换 provider 后，adapter 自己的默认值可以重新求值；显式值和 adapter 默认值不会混成无法解释的一组参数。

模型流返回后，每个 chunk 先以 `assistant/chunk` 追加，`BlockAssembler` 再构造完整 assistant message。流结束时追加 `assistant/message`，并用 source event seq 关联原始 chunks。UI 可以实时消费 chunk，恢复或模型上下文则使用完整消息，两者仍能追溯到同一次请求。

若流以 error 或 aborted 结束，`agent/request-error` waterfall 可以决定是否重试。默认没有隐藏重试；只有插件明确返回 retry，循环才重新请求。这样重试策略也属于可装配能力，决定权在插件层。

### 4.4 工具可以并发执行，但结果按模型顺序提交

assistant message 包含 tool-call block 时，调度器先为每个调用构造独立 `ToolExecutionInput`，再根据工具当前的 execution mode 分组：exclusive 调用形成屏障，parallel 调用进入有上限的滚动池。

并发只发生在 dispatch/body 阶段。pre-execute、结果提交和 additional context 接受仍按模型给出的调用顺序推进。这样既允许独立工具重叠执行，又避免较快的后置调用先写入会话、改变下一次模型看到的工具结果顺序。

每个调用先记录 `tool/call`，再进入：

```text
tools/pre-execute
  -> monotonic guards
  -> tools/execute
  -> tool body/provider
  -> tools/post-execute
  -> finalizeContent
  -> tools/result
  -> SessionEvent tool/result
```

策略可以拒绝或要求审批，但单调 guard 只允许 deny 或 abstain，不能把已拒绝的调用重新放行。工具 body、沙箱和审批之间的关系因此不需要硬编码进 Agent Loop。

取消发生时，调度器停止补充新调用，等待已经启动的调用收敛，并为尚未 dispatch 的模型调用记录规范化的 aborted result。这样重放时不会留下只有 call、没有 result 的半条模型历史。内部 scheduler 自身失败则不同：它保留已经记录的 call 并抛出失败，不伪造一个普通工具结果来掩盖运行时故障。

### 4.5 取消、dispose 与“完成”的证明范围

`cancel()` 可以清空 inbox，并中止当前 activity 的 AbortSignal。驱动器在边界捕获取消，把 Turn 结束原因记为 aborted，然后回到 idle。若取消后又有唤醒消息，它属于下一个 Turn，不会加入已经中止的 activity。

Agent 的 dispose 除了从 Map 删除，还要执行 factory 的反向 teardown：

1. 以 `disposed` 原因取消机器；
2. 等待 `whenIdle()`；
3. dispose Agent scope；
4. 从 Agent 与 Session registry 撤销注册；
5. 释放 factory ownership 记录。

因此 `whenIdle()` 能证明驱动器已经不再持有当前或随后唤醒的工作，dispose 能进一步证明作用域和注册关系已撤销。它们仍不能证明外部副作用已经被业务补偿，例如一个工具已成功调用第三方 API；这种补偿必须由工具或上层工作流另行设计。

### 4.6 本章结论与调试检查

默认执行链的关键在边界：inbox 决定工作何时进入，Turn/Step 决定事实何时落盘，request header 记录模型真实看到的配置，工具流水线决定副作用何时获准，idle/dispose 决定进程内工作何时收敛；while loop 只是驱动这些边界的载体。

调试一次任务时，应至少核对：

- `turn/start` 与 `turn/end` 是否成对，结束原因是什么；
- 每个 `step/start` 是否有对应 `step/end`；
- request header 是否与实际 provider/model/system/tools 一致；
- assistant chunks 是否汇聚到一条完整 message；
- 每个 `tool/call` 是否有按序关联的 `tool/result`；
- steer、followup 与 additional context 实际进入哪个 Step 或 Turn；
- cancel 后是否仍有迟到事件、未收敛进程或未撤销注册。

## 第五章 会话事实与可回放状态

### 5.1 “模型可见即已记录”的机制与边界

第四章追踪的是仍在运行的 Agent：inbox 是否有工作、当前 activity 是否被取消、工具进程是否结束、驱动器是否回到 idle。这些状态会影响此刻如何调度，却不都适合成为长期事实。

DSH 给出了另一条边界：凡是会影响下一次模型请求如何重建的内容，必须能从 `SessionEvent` 日志得到。日志中的基本信封包含 `type`、连续递增的 `seq`、毫秒时间和 lossless JSON `data`；一旦事件被接受，它及其嵌套数据会被冻结。`session/event` 是提交后的观察通知，listener 失败不会反向撤销已经进入日志的事实。

因此，下列两组状态不能混用：

| 状态 | 例子 | 是否是恢复依据 |
| --- | --- | --- |
| 持久事实 | Turn/Step 边界、用户消息、完整 assistant message、tool call/result、实际 request header、compaction replacement | 是，由 SessionEvent 重建 |
| 进程内控制 | inbox 的未领取队列、running/idle、AbortSignal、当前 listener、尚未提交的工具 body 内部状态 | 否，除非另有持久入口或外部系统记录 |

这条边界对插件作者很严格。向临时 `messages` 数组塞入一段文本虽然能影响当次调用，却会在 resume 后消失；只向 UI 发一条 WebSocket 消息也不能成为会话事实。DSH 的默认路径先把模型可见输入追加成 surface event，再调用 `deriveMessages()` 构造请求。

它仍达不到“所有运行状态都可回放”。例如，`tool/call` 证明 Harness 记录了将要执行的调用，但不证明第三方系统究竟执行到哪一步；凭据是 adapter 构造参数，不进入会话；未被 Agent 领取的外部队列消息也需要入口自身提供持久化。SessionEvent 是 Agent 会话的事实来源，不延伸到整个分布式业务。

### 5.2 一条事件账本同时保留语义、原始流和边界

贯穿任务的一次正常修改可以形成如下账本：

```text
turn/start
  step/start
  user/message                 # 人类输入、steer 或注入上下文
  request/header               # 实际 config、system、tools
  request/context              # route 与 context window 变化
  assistant/chunk*             # 原始流，供实时展示和追溯
  assistant/message            # 完整模型消息，引用 chunk seq
  tool/call                    # 原始 name、arguments、callId
  tool/result                  # 模型可见结果，引用 call seq
  step/end
turn/end                       # completed / aborted / blocked / error / max-tokens
```

这里有三类不同信息：

- 边界事件回答“运行到哪里、为什么停止”，但不直接进入模型消息。
- `assistant/chunk` 保留 token 级流，完整 `assistant/message` 才进入后续模型上下文。
- `user/message`、`assistant/message`、`tool/result` 是三种 surface-eligible event；它们必须声明如何进入模型可见顺序。

`sourceEventSeqs` 建立派生关系。例如完整 assistant message 可以引用生成它的 chunks，tool result 可以引用相应 call，压缩摘要可以引用被覆盖的节点。它只表达该日志内部已知的来源事件，不承担跨服务 trace id 的职责，也不会自动证明因果完整性。

事件词汇可以由插件扩展，但固定提交内的扩展是 TypeScript declaration merging（`SessionEventMap`），对仓库外下游插件没有运行时注册面；兼容策略仍保守。未知事件只有显式标为 `ignorable: true` 时，旧 reader 才能跳过；未知的 required event 必须拒绝恢复。Session header 另有单调格式版本。固定提交仍是 format `0`，注释明确说明项目尚未发布，不承诺兼容迁移，因此“追加式日志”不能等同于“未来版本天然可读旧数据”。

### 5.3 Surface 是模型视图

DSH 没有通过改写旧日志来压缩上下文。每个模型可见事件带一个 `surfaceOp`：

- `append` 把节点加到当前 surface 尾部；
- `replace(start, end)` 用一个新节点遮蔽已有的连续 surface 区间。

`deriveMessages()` 按 surface 中的事件序号读取 `user/message`、非空 `assistant/message` 和 `tool/result`。普通追加只增量投影新节点；发生 replacement 时，缓存按 generation 重建。旧事件仍在 append-only log 中，新 replacement 通过 `sourceEventSeqs` 引用被遮蔽节点。

这形成了两个都合理、但用途不同的读模型：

```text
append-only SessionEvent log
  ├─ current surface → deriveMessages() → 下一次模型请求
  ├─ append-origin surface events      → 用户完整 transcript
  ├─ event folds                        → token、统计、标题、todo 等投影
  └─ raw events                         → 遥测、审计、故障诊断
```

用户 transcript 不应直接读取 current surface。源码注释明确指出，replacement 会从模型视图中遮蔽旧对话；若 UI 也照此删除，用户会看到历史凭空消失。完整 transcript 应读取 `surfaceOp: append` 的原始节点，replacement 留给模型上下文。

同理，UI、遥测和统计并不必然显示完全相同的数据：它们共享事实源，但使用不同投影。共享日志消除的是互相矛盾的写模型，不强迫每个 consumer 使用同一展示模型。新投影必须说明自己的水位、重放成本、未知事件策略和 retention，而不能悄悄维护一份无来源的可变状态。

### 5.4 写入、checkpoint 与恢复分别保证什么

实时 append 不阻塞文件或数据库 I/O。持久化 coordinator 订阅 `session/event`，把冻结事件放入每会话 write-behind 队列；后台失败时保留待写批次。`session/flush` 取消批处理等待，等待初始化和当前/待处理写入排空。也就是说：

- `Session.append()` 返回，证明事件已进入进程内权威日志；
- `ctx.sessions.flush(session)` 成功，证明所有已参与的 persistence listener 已成功收敛；
- 没有配置 persistence listener 时，`flush()` 可以成功返回 `false`，不能据此宣称已有磁盘耐久性。

`session-checkpoint-policy` 把 flush 放在三个语义边界：模型 adapter 第一次取流之前、顶层工具 body 执行之前、每个 `agent/pre-step` 进入后续请求之前。checkpoint 失败会阻止模型请求或顶层工具副作用继续执行。这是 fail-closed 的写前屏障。

它保证的是“导致本次外部动作的会话前缀已落盘”，不保证模型 API 或工具副作用与日志处于同一个事务。如果工具已经执行成功、进程却在 `tool/result` 耐久化前崩溃，恢复代码只能把结果标成 outcome unknown，并提示先验证外部状态；它不能安全地自动重试一个非幂等写操作。

冷恢复过程分三步：

1. 后端读取 header 与有效的连续事件前缀，识别最后的 torn tail。
2. coordinator 验证 id、format、event envelope 和 surface transition。
3. 对完整但未闭合的尾部，生成缺失的 tool error、`step/end` 和 `turn/end(interrupted)`；修复提交后重新读取精确 revision，再交给 resume。

恢复会区分两种悬空工具调用：模型已经提出、但还没有 `tool/call` 记录的调用标成 `TOOL_NOT_STARTED`；已经有 `tool/call`、却没有耐久 `tool/result` 的调用标成 `TOOL_OUTCOME_UNKNOWN`。这比“一律重试最后一步”安全，但也把业务验证责任明确留给工具和调用方。

后端共享 coordinator 语义，物理保证不同：

| 维度 | JSONL | SQLite |
| --- | --- | --- |
| 布局 | 每会话独立日志，默认拼接 Zstandard frames，也可原始 JSONL | 一个数据库中的 session/event rows |
| 首次写入 | header 与首批事件先写临时文件并同步，再无覆盖发布 | session row 与整批 events 在同一事务提交 |
| 后续批次 | append 后 `fsync`；失败时截回原字节长度 | 整批 INSERT；失败回滚整个事务 |
| 尾部修复 | truncate 与 append closers 可分成两个已同步步骤 | DELETE torn rows 与 INSERT closers 在一个事务中 |
| 从水位读 | 顺序扫描完整 artifact 后跳过前缀 | SQL 直接查询 `seq >= fromSeq` |
| 单会话原始 artifact | 支持 | 不支持 |

两者都要求单会话写入由同一个活动 owner 协调。固定提交没有对外提供 session 删除或 retention API；备份、保留期限和清理仍是部署团队的运维责任。

### 5.5 Resume、fork 与 compaction 的语义不能互换

`resume` 读取同一个持久 session id，准备一个尚未发布的 Session，完成必要修复和 revision 复核后，再由 Agent factory 执行 setup 与 publication。它延续的是原会话身份和完整持久历史。

`fork` 则从一个当前 live session 选择稳定前缀创建新 id。boundary 是包含端事件序号；所选前缀如果结束在 open turn 内会被拒绝。child header 记录 `parentSession` 与 `seedLength`，构造器再追加 `session/end-seed`，区分继承历史与子会话新工作。它从已闭合事实分支，不复制正在执行的调用栈。

`compaction` 不创建新身份，也不删除历史。token meter 从 request header、surface 和 provider usage/估算值重放当前压力；tool-result pruner 通过 replacement 保留头尾并遮蔽超长中段；basic compaction 选择可压缩区间，记录 start/end 和摘要，再用 checkpoint message replacement 改写模型 surface。失败的压缩尝试也留下边界事实，旧内容仍可用于审计。

三者的区别可以概括为：

| 操作 | 身份 | 原始历史 | 模型当前视图 | 可继续位置 |
| --- | --- | --- | --- | --- |
| resume | 同一 session | 保留并修复尾部 | 从完整日志重建 surface | 最近的平衡持久前缀之后 |
| fork | 新 session，记录 parent | 继承指定闭合前缀 | 从 seed 重建，随后独立演进 | child 的新 lifecycle |
| compaction | 同一 session | 旧事件不删除 | replacement 遮蔽旧 surface 区间 | 同一会话的后续 Step |

### 5.6 本章结论与恢复演练

DSH 会话机制的核心价值是把事实、投影、耐久屏障与恢复拒绝条件放在同一套契约里；JSONL 和 SQLite 只是它的两个后端实现。它能重建模型消息、请求头、工具配对和 Turn/Step 边界，也能在 crash 后把不确定性写回日志；它不能重建工具进程内存、未持久入口消息或第三方副作用的真实结果。

一次最低限度的恢复演练应保留并比较以下证据：

1. crash 前最后一次成功 flush 的 event seq 与 artifact revision；
2. crash 后 `inspect` 的内存修复视图与 `load` 提交后的物理日志；
3. synthetic closer 的 error code、source seq 和 `turn/end` reason；
4. resume 后第一条 `request/header` 的 reason 与 `deriveMessages()` 结果；
5. 对 outcome unknown 的外部状态核验记录，确认没有盲目重试；
6. fork child 的 `parentSession`、`seedLength` 和 `session/end-seed`；
7. compaction 前后 current surface、append-origin transcript 与 token pressure 的差异。

完整事件、生产者、消费者和耐久性对照见[附录 B]({{ '/appendices/event-and-lifecycle-map/' | relative_url }})。

# 第三篇 能力、产品与信任

## 第六章 可替换能力体系

第二章给出的是运行时骨架，这一章看骨架上的能力本身：模型、工具、执行世界、上下文与长任务能力在固定提交中如何声明、替换，替换后哪些契约保持不变。官方文档把这些接口称为能力 seam（`docs/capability-seams.zh.md`），并规定一个 seam 由三个角色组成：声明服务契约的 Definition、注册实现的 Provider、调用能力的 Consumer。对熟悉后端 SPI 或 provider 接口的读者，可以把 seam 理解为“接口 + 实现注册表 + 消费者”，差别在于注册本身是 Cordis 生命周期 effect：注册返回 disposer，Fiber 卸载时撤销。

### 6.1 判断“可替换”的验收标准

固定提交中 seam 的标准形态：

- Definition 通过 declaration merging 把服务挂到 `ctx.<name>`，例如 `ctx.llm`（`packages/llm/llm/src/index.ts:46`）、`ctx.fs`、`ctx.subprocess`、`ctx.web`、`ctx.sandbox`、`ctx.subagents`、`ctx.jobs`、`ctx.settings`、`ctx.credentials`、`ctx.sessionPersistence`。
- Provider 插件在装配期注册实现；注册动作是 `ctx.effect`，disposer 随 Fiber 卸载撤销路由。
- Consumer 只依赖服务接口，例如 agent-loop 消费 `ctx.llm` 与 `ctx.tools`，tool-fs 消费 `ctx.fs`，bash 执行器消费 `ctx.subprocess`。

代表性 seam 与角色分布：

| 服务 | Definition | 固定提交中的 Provider | 主要 Consumer |
| --- | --- | --- | --- |
| `ctx.llm` | dsh-llm | llm-deepseek、llm-pi-ai、llm-replay | agent-loop、compaction-basic |
| `ctx.tools` | dsh-tools | 各工具包注册 ToolDefinition | agent-loop 与各工具 |
| `ctx.fs` | dsh-fs | fs-local、fs-sandbox、fs-e2b | tool-fs |
| `ctx.subprocess` | dsh-subprocess | subprocess-local、subprocess-e2b | bash、terminal、lsp、进程外 subagent 后端 |
| `ctx.sandbox` | dsh-sandbox | sandbox-local | bash-sandbox、terminal-bash |
| `ctx.web` | dsh-web | web-search-exa / perplexity / deepseek、web-fetch-http | tool-web |
| `ctx.subagents` | dsh-subagent | spawn / fork-in-process、acp、codex、claude-code、dsh-sdk | tool-subagent、tool-ralph |
| `ctx.sessionPersistence` | dsh-session-persistence | jsonl、sqlite | agent-loop、session-query 等 |

“接口存在”不能当作“可替换”的证明。以下四条同时成立才算：

1. 声明与实现分离：Consumer 不引用具体 Provider 包，换 Provider 不改 Consumer。
2. 冲突 fail loud：`ctx.llm.registerAdapter` 对重复 provider 抛 `DUPLICATE_ADAPTER`，整批注册全有或全无（`packages/llm/llm/src/index.ts:338`）。
3. 替换原子：注册句柄的 `replace` 在一个同步段内换路，读方观察不到空档（`packages/llm/llm/src/index.ts:405`）。
4. 卸载可撤销：disposer 执行后路由消失，再用旧句柄操作抛 `REGISTRATION_DISPOSED`（`packages/llm/llm/src/index.ts:361`）。

四条缺一，得到的只是“参数可配置”。替换后不变的是什么同样关键：Consumer 拿到的调用语义、错误码和 SessionEvent 词汇。下面各节按这条标准逐个检查。

### 6.2 模型 seam：从 provider 目录到冻结请求

`ctx.llm` 是 adapter 注册表加一个可被 waterfall 拦截的流式调用入口（`packages/llm/llm/src/index.ts:280`）。注册分两类：

- `registerAdapter(providers, adapter)` 立即生效的 provider 路由。校验整批通过才写入：provider 名非空、元数据 id 与 provider 一致、不与现有路由冲突；disposer 随 Fiber 卸载删除全部路由（`index.ts:338-367`）。
- `registerConfigurableProviders(entries)` 目录式路由：只声明“可被配置激活”的 provider 及所属 settings 命名空间，供设置界面和组合使用（`index.ts:431-484`）。

每次模型调用都经过 `llm/stream` waterfall：listener 调用 `next()` 到达已解析 adapter 的流，也可以自己产出 chunk 短路（`index.ts:64`、`index.ts:921`）。请求头记录发生在 dispatch 前，因此同一个注册的解析结果与派发绑定在一起：`prepareCall` 把 provider/model 解析一次、深冻结、只允许派发一次，config 与准备时不一致抛 `INVALID_PREPARED_CALL`（`index.ts:779-814`）。HMR 换掉 adapter 时，旧解析结果无法交给新 adapter 派发。

解析阶段不做静默适配：模型不支持显式 reasoning effort 时，在 provider I/O 之前抛 `UNSUPPORTED_REASONING_EFFORT`，没有降级或别名（`index.ts:720-729`）。目录里的模型清单只是建议性目录，消费方不能把“清单里没有”变成请求拒绝（`index.ts:199-203`）。

失败契约也是 seam 的一部分：adapter 选择、派发和迭代失败统一变成终止 chunk（`error`/`aborted` finish），中间件与消费方的失败保持抛出（`index.ts:838-900`）；`LlmError` 携带 provider 无关的稳定错误码（如 `AUTH`、`RATE_LIMIT`、`NO_ADAPTER`）和冻结的可序列化事实（status、retry-after、requestId）（`index.ts:79-117`）。

凭据走另一条边界：配置只携带对机密的引用，Provider 拥有实际值。llm-deepseek 注入 `ctx.llm`，读取自己的 settings 段，按操作解析凭据，轮换后的凭据在下一次请求生效（`packages/llm/llm-deepseek/src/index.ts:42`、`229`）。密钥在进入 fetch 前被校验，诊断信息只报引用位置，不回显密钥（`llm/src/index.ts:119-152`）。固定提交里 `ctx.llm` 有三个 Provider：直接 fetch 的 llm-deepseek、库后端 pi-ai、测试回放的 llm-replay；每个 Provider HTTP 请求必须携带 attributionHeaders（`index.ts:174-178`）。

### 6.3 工具 seam：定义、策略、执行与结果归一化

`ctx.tools` 是工具注册表加一条受监管的执行流水线。一次模型工具调用的完整顺序（`docs/tool-execution-pipeline.zh.md` 与 `packages/core/tools/src/index.ts` 对照）：

1. 执行前先记录 `tool/call` SessionEvent，UI 出现 pending 卡片。
2. `tools/pre-execute` waterfall：hooks、权限、沙箱策略在这里改写或拒绝调用（`index.ts:152`）。
3. 单调 guard：任何 guard 可以凭理由拒绝，任何 guard 都不能强制放行另一个 guard 已拒绝的调用；guard 看到的是身份受保护的调用（`index.ts:1101-1108`）。
4. `ctx.approval` 一次性询问：无回答方时 fail-closed 拒绝；`allowed-once` 之后才进入 guard（`index.ts:584`）。
5. `tools/execute` waterfall 环绕派发：超时、重试、指标在这里包装，不进入工具 body（`index.ts:163`）。
6. 工具 body 执行；tool-fs 的写操作必须通过 `fs/write-intent`/`fs/edit-intent` 单一决策槽，该槽由 fs-observation-policy 占据且不调用 `next()`（`packages/fs/fs-observation-policy/src/index.ts:116`）。
7. `tools/post-execute` waterfall：接受、阻止、替换结果或追加 context（`index.ts:175`）。
8. 注册表外层归一化：流水线或结果快照抛出的异常变成 `isError` 结果。
9. `ToolDefinition.finalizeContent` 是最后一道只允许改内容的不变式（`index.ts:240-247`）。
10. `tools/result` 同步通知，此时完整结果已被冻结（`index.ts:376`）。
11. 记录唯一的 `tool/result` SessionEvent，模型只看到这一个结果；additionalContexts 按 FIFO 在已记录的工具结果之后注入。

这条链的边界很明确：拒绝是单调的，后置插件不能把已拒绝的调用放行；审批是一次性的；guard 只能收紧。工具定义还声明呈现模式（`generic`/`terminal`/`diff` 与 locations），呈现方法是 args 的纯函数（`packages/core/tools/src/presentation.ts`）。Code Mode 把保留的 `run_code` 传输及其序列化子调用送入同一条流水线：子调用携带父 token，记录 `tool/code-dispatch`，拒绝呈现为有约束力的驳回，并省略 additionalContexts，保持调用与结果相邻（`docs/tool-execution-pipeline.zh.md:62`）。

### 6.4 执行世界 seam：文件、进程、Shell 与沙箱

文件系统 seam 的语义由版本与意图控制。`ctx.fs` 的写操作接受新鲜度 token：`createIfAbsent` 或 `replaceIfVersion(version)`，字面量编辑返回编辑前后的文件内容（`packages/fs/fs/src/types.ts:29`、`124`、`146`）。Provider 有三个：fs-local、按共享沙箱模式限制变更的 fs-sandbox、以及运行在 E2B 远程工作区的 fs-e2b。fs-observation-policy 通过 `fs/*` 事件门禁观测类贡献，其中 `fs/observed` 保持同步且不抛错（`packages/fs/fs-observation-policy/src/index.ts:124`）。

进程 seam 的强语义是进程树终止。`ctx.subprocess` 的 `SubprocessHandle` 承诺：POSIX 上给分离的进程树发信号，Windows 上 `taskkill /T`，辅助进程不能比树活得更久；终止是 SIGTERM → `graceMs` → SIGKILL 的升级，幂等，且由 spawn spec 的 AbortSignal 触发（`packages/subprocess/subprocess/src/types.ts:91-184`）。bash 执行器、PTY 终端、LSP host 和进程外 subagent 后端都通过 `ctx.subprocess` spawn，因此取消语义来自同一个 seam。

Shell 与沙箱叠加在其上。`ctx.shell` 的 Provider 是 bash-local、bash-sandbox、pwsh-local；tool-bash/tool-pwsh 与 Claude Code/Codex 钩子桥是 Consumer。shellEnv 把作用域内的 `DSH_*` 事实在每个工具执行时收集成快照。`ctx.sandbox` 的 sandbox-local 按策略生成平台 profile：Linux 下构造 bwrap 参数（`packages/sandbox/sandbox-local/src/profiles.ts:12`），macOS 下生成带可写根的 sandbox-exec SBPL profile（`profiles.ts:44`）。sandboxPolicy 是部署默认模式与工作区根的唯一出处，bash 与 fs 两类强制组件都读它，因此二者不会各自限制到不同根（`docs/capability-seams.zh.md:454`）。

Provider 无法提供某项语义时显式拒绝，不做“兼容模式”静默降级：模型能力的显式 effort 不支持时在 I/O 前拒绝（6.2），沙箱后端按每次调用包装 argv 并报告强制情况（`docs/capability-seams.zh.md:453`）。换执行 Provider 时，工具 schema、审批链与日志词汇保持不变——它们属于 `ctx.tools` 流水线，执行差异被封在 seam 内。

### 6.5 上下文能力的组合方式

模型上下文由 `ctx.systemPrompt` 在每个 Step 组装：有序 sections、动态 context、工具 schema 与 prompt 变量四类贡献，经过 `system-prompt/assemble` expert waterfall 合并（`packages/core/system-prompt/src/index.ts:20-31`）。每个 section 有唯一名，文本支持 `{{variable}}` 插值；标记为 complete 的 section 单独成为整份 system prompt，出现多个生效 complete section 时组装失败（`index.ts:52-72`）。动态 context 物化为持久的 user-role 快照（`index.ts:77`）。

其余上下文能力沿同一“事实从哪来”的边界分布：

- `ctx.attachments`：宿主在会话事件之前提交已接受的图片；Provider 适配器把已授权的持久引用解析为 Provider 原生内容（`docs/capability-seams.zh.md:416`）。
- `ctx.skills`：合并各 Provider 的 skill 目录，tool-skill 渲染会话前缀目录并加载完整正文（`:443`）。
- session reference resolver：把当前 surface 中有界的对话快照投影为持久但不可信的消息上下文，提及语法归 Host 适配器（`:433`）。
- `ctx.spillStore`：后端保存过大的工具文本，返回面向模型的定位信息与取回提示；spill-policy 作为 tools/post-execute 消费方决定何时 spill（`:463`）。

这条边界把两类内容分开：临时 prompt contribution 只影响当次调用，模型可见的持久事实必须能从 SessionEvent 重建（第五章的规则）。所有注册都是 effect，Provider 卸载后其 section、tool schema 与附件引用随 Fiber 撤销；已经生成的请求和已经持久化的事件保持不变。

### 6.6 长任务能力的事实归属

长任务能力的关键问题只有一个：状态放在哪里。固定提交给出三档：

| 归属 | 能力 | 证据 |
| --- | --- | --- |
| 从 SessionEvent 折叠 | goal、plan、todo、compaction | goal 是纯回放折叠（`packages/goal/goal/src/fold.ts:1`），create/edit/pause/resume/complete/block 六种操作、四种阶段；plan-mode 折叠已记录的计划状态；todo 通过 session projections 派生 |
| 进程内 | jobs-local 注册表、terminals、goal 的实时延续激活 | jobs id 形如 `<kind>-N`，注册表是进程本地（`packages/jobs/jobs/src/types.ts:47-101`）；terminal 注册表负责按 Agent 的身份与清理 |
| Provider 一侧 | 进程外 subagent 的运行状态 | acp/codex/claude-code/dsh-sdk Provider 的另一端各自拥有状态 |

subagent 的委派边界值得单独看清。`SubagentRunRequest` 携带父 Agent，规范化取消通道是发起工具调用的 `exec.signal`，启动前后都有效（`packages/subagent/subagent/src/types.ts:106-115`）。spawn-in-process 创建全新子会话；fork-in-process 用父会话已完成 turn 的平衡前缀做 seed，seed 止于最后一次 `turn/end`，当前 tool-call turn 不进入（`packages/subagent/subagent-fork-in-process/src/index.ts:4-5`、`41`）。进程内子会话的 header 记录 `parentSession` 为父会话 id（`subagent/src/types.ts:252`）。消费方必须 dispose 才能取消（`types.ts:243`）。tool-subagent 在一次性与可延续委派之间选择，tool-subagent-control 传递后续消息，tool-ralph 要求一条全新的结构化输出路由（`docs/capability-seams.zh.md:460`）。

workflow 引擎每个 Context 一个，Provider 是 worker-thread；引擎终止路径在 worker 超过宽限仍被杀时合成 outcome `cancelled`（`packages/workflow/workflow/src/index.ts:73`）；workflow 里的 `agent()` 调用通过 `ctx.subagents` 扇出。compaction 的基础后端消费 Step 后的压力事件与请求错误恢复事件，没有面向模型的 compaction 工具；toolResultPruner 在摘要前用可回放的单节点 surface 替换改写过大的工具结果（`docs/capability-seams.zh.md:459`、`419`）。

由此得到本章的边界：goal、plan、todo 这类状态能跨重启从日志折叠回来；jobs、terminal、实时延续激活随进程消失；进程外 subagent 的状态在另一端。固定提交只证明这些注册面与归属关系，跨重启恢复、分布式调度与 exactly-once 语义仍需在目标环境验证。

## 第七章 自扩展与多端产品形态

第七章把两件事分开研究：受控动态代码如何进入、运行、检查与撤销；Web、Headless、ACP、SDK 如何用各自协议访问同一 Agent/Session 核心。前四节处理扩展表面、动态包生命周期与协议边界，7.4—7.6 处理多入口的投影、所有权与验收。贯穿的判断标准：多入口共享的是会话事实与运行时能力，各入口的协议、连接生命周期与进程内状态归属各自独立。

### 7.1 先划开运行时扩展与产品入口

DSH 的扩展能力落在四个互不相同的表面，混用它们会同时错判权限与生命周期：

| 表面 | 进入方式 | 归属与生命周期 |
| --- | --- | --- |
| 静态 Loader plugin | 随 bundle/profile 在启动时装配，进入 Loader entry 树 | 进程级，参与 HMR 与组合回滚（第二章） |
| 动态 Cordis Package | 运行期由模型或用户 define，分 Host/Client 两半 | 会话归属，可审批、撤销、undefine（7.2） |
| 远程 API | Host 服务经 Typert 生成 Remote 方法暴露 | Host 实现驻留服务端，Client 拿协议描述（7.3） |
| UI module | 浏览器端插件行，经 modules 行进入 roster | 浏览器进程，随会话镜像生灭（7.4） |

静态表面与动态表面走两套生命周期：Loader plugin 的 entry 树更新、回滚与 HMR 由 Loader 管理（第二章），动态包由 `DynamicCordisRegistry` 独立持有身份与激活状态，不进入 Loader 的 entry 树。四个表面可以叠加——动态包可以用 `harness.handle` 暴露 Client 可调的私有 RPC（sandbox.ts 的注册助手）——叠加改变的是能力来源，不改变各自的生命周期归属。

四个表面的权限面也不同：静态表面由部署组合决定，动态表面由会话审批决定，远程 API 只暴露 `@Remote` 标记的方法，UI module 只影响浏览器进程。判断一个扩展属于哪个表面，先看它由谁创建、谁能撤销：Loader 撤销的是进程级组合，registry 撤销的是会话级激活，Gateway 撤销的是贡献注册，页面撤销的是事件订阅。四者的撤销语义都落在各自 fiber 的 effect 上（第二章），差别在创建入口与审批路径。

三类身份对应三个层次：`CordisDynamicPluginId` 是稳定插件实例，`CordisDynamicPackageId` 是不可变版本，`CordisDynamicPluginRunId` 是某一次激活，由 registry 分别铸造（`packages/extensions/cordis-host-runner/src/registry.ts:154`、`types.ts:10`）。启动冲突时，错误信息给出替换配方：先 stop 占用名字的旧 run，再 run 新版本（`lifecycle.ts:35-42`）。

“可以加载”与“允许不受信任代码运行”是两件事：Host 半在 `node:vm` 新 realm 中求值，沙箱把文件、网络、进程、定时器引导到 `ctx.fs`、`ctx.web`、`ctx.bash` 与 Cordis timer，并提供 `harness.handle`/`defineTool`/`registerTool` 注册助手；源码注释明确这不是隔离，宿主 realm 的辅助函数仍是逃逸路径（`packages/extensions/cordis-host-runner/src/sandbox.ts:2`）。plugin-inventory 只提供当前 Loader 树的只读投影，带当前 root Fiber 阶段，且无缓存、无历史、无变更路径（host-plugin-inventory README 说明）。固定提交的扩展边界是：动态包在 `node:vm` 中求值（注释明示非隔离），远程 API 只接受有生成描述符的一元方法；除此之外的代码注入与任意求值面，固定提交源码未显示。

### 7.2 动态 Cordis Package 的完整生命周期

`define` 校验非空 name/purpose、至少一个代码 half、`idPrefix` 为 3–6 个小写字母，然后为 session 归属的 plugin 铸造 `pluginId`，把新 `packageId` 指向一份不可变定义（`packages/extensions/cordis-host-runner/src/index.ts:151`、`registry.ts:37`）。版本按 define 顺序累积，替换版本通过 `mode: 'update'` 表达，已定义版本不被修改。动态 Package 近似后端的动态模块热插拔，差异在于它多一道审批、版本不可变与撤销所有权。

`run` 先解析激活计划：含 Client 代码且该版本未获批时进入 `awaiting-approval`，否则直接 `starting-host`（`index.ts:248-282`）。审批可以授权同一 plugin 的后续版本（`clientVersionUpdatesApproved`，`registry.ts:58-61`）。同一 plugin 已有 pending run 请求时，新 run 以 `transition-in-flight` 拒绝，避免两个激活竞争同一名字（`index.ts:264-265`）。状态的推进与终点如下：

| 状态 | 含义 |
| --- | --- |
| `awaiting-approval` | 等待用户对激活请求的决定 |
| `starting-host` / `client-pending` | Host 半启动中 / Client 半等待装载 |
| `running` / `waiting` | 激活成功；等待缺失的 inject 或页面装载 |
| `rejected` / `failed` / `cancelled` / `stopped` | 审批拒绝 / 启动失败 / 请求撤销 / 主动停止 |

状态沿 `awaiting-approval → starting-host → client-pending → running/waiting` 推进（`types.ts:105-114`）。激活请求经 `cordis/request-run` 事件广播给浏览器页面，页面可对该 `requestId` 作答；决定落定后再广播 `cordis/request-run-resolved`（`index.ts:291,1016`）。`stop` 与 `undefine` 都会先 `retract` 已广播的运行再撤销（`index.ts:215,464`），页面持有的旧 run 身份随之失效。

激活可以由模型工具发起，也可以由用户面板发起：`runHostHalf` 接受 `requestId: null` 表示直接用户手势，跳过审批关联；`undefineFromPanel` 在移除后把状态变更入队给模型的下一步（`index.ts:226-229,320-324`）。Host 半启动把沙箱产物作为 `cordis-dynamic` 组的子 fiber 启动并等待 settle，启动失败先 dispose 再抛，避免失败 run 残留（`lifecycle.ts:22-45`）；settled 但未激活的 fiber 用 `missingServices` 报告还在等待哪些 inject（`lifecycle.ts:55-57`）。

`inspect` 返回当前 run 与最近一次尝试的诊断；`stop` 通过 `fiber.dispose()` 的反向 teardown 撤销该 fiber 注册的一切 effect；`undefine` 先取消 pending 审批，再撤销运行并删除 plugin 全部版本（`index.ts:210-217`）。审批用 `claimRequest` 先答先得，撤单走 `disarmRequest`（`registry.ts:251-263`）。

边界：stop/undefine 撤销的是注册进 fiber 的进程内资源（服务、事件、handler、tool），不补偿动态包已经触发的文件写入、网络调用等外部副作用——与第二章的 ownership 边界一致。

### 7.3 Host—Gateway—Client 的协议边界

Typert 把服务方法变成可检查协议：业务服务用 `@Remote`/`@RemoteScope` 标记对 Client 开放的方法，未标记方法不进入生成产物；`@RemoteScope` 先经 `ctx.typert.contexts` 把 identity 解析为作用域 Context，再从该 Context 取服务调用（api-gateway.zh.md 文档说明）。文档示例展示了两种标记的形态：

```ts
export class GoalService extends TypertRemoteService {
  @Remote('create')
  createForClient(agent: Agent, request: CreateGoalRequest, signal: AbortSignal): CreateGoalResult {
    signal.throwIfAborted()
    return this.create(agent, request)
  }
  @RemoteScope('agent', 'current')
  currentForClient(): CreateGoalResult { /* ... */ }
}
```

生成器在构建期分析业务包类型，产出 `./typert` 反射工件与 Client Remote 生成代码（typert/generator 包）。Host 对象不能直接跨 wire，业务包通过 `TypertLookupMap` 声明 Host 与 wire identity 的关联，Gateway 在调用前把 `agentId` 解析回 `Agent`。

`TypertRegistry` 保存生成 schema、反射元数据与 `InvocationDescriptor`，`register()` 原子提交整个贡献并返回 effect disposer（`packages/typert/registry/src/service.ts:189`）；`typert-loader` 在启动时解析每个包 `./typert` 导出并注册（`packages/typert/loader/src/index.ts:38`）。`InvocationDescriptor` 把每个 Remote 端点固定为 namespace、method 与参数/结果 schema（`packages/typert/protocol/src/types.ts:173`），严格模式只接受有生成描述的端点；`ctx.typert.lookups.configure()` 允许 Host 组合覆盖某个 lookup key 的解析策略，不改业务包拥有的参数名与 wire 字段（api-gateway.zh.md 文档说明）。

Gateway 的 `invoke()` 对每个调用解析描述符与 Cordis 服务、校验具名参数、解析 lookup/Context 身份、调用业务方法并校验结果（`packages/api/gateway/src/index.ts:145`）。取消感知方法以 `signal: AbortSignal` 收尾——它是描述符元数据，不是 wire 参数。SRC 模式是给从未有过严格定义的端点用的开发回退，只解析简单参数名并接受 JSON-safe 值；已观察到的严格定义被撤销会失败而不是放松校验（api-gateway README 文档说明）。Client 面 `$mount()` 校验生成贡献并安装 `remote.<namespace>`，调用经 `ctx.connection.rpc.call('/api', endpoint)` 发出（`packages/api/gateway/src/client/index.ts:100`）；返回的 `RemoteResult` 把业务失败折叠进 `ok: false` 分支，消费方不需要为每个调用再包一层恢复（`packages/typert/protocol/src/types.ts:60`）。

连接层：Host 独占 `/api` 路由，Typert 拦截器先认领 Remote 端点，未认领的请求回落到 API Proxy；`events.mux` 与 `events.host` 是两条只下行的 WebSocket，客户端在这些 socket 上发送应用数据属于协议违规（`packages/client/connection/src/websocket-downlink.ts:48`）。事件转发面由 Host 组装用 `TypertRemoteEventSelection` 声明一次，Client 的 `$on` 只接受该选择内的键（`packages/typert/protocol/src/types.ts:80`）。浏览器信任围栏要求 `/api` 下每个请求呈现 loopback 或 `trustedHosts` 匹配的 Host，显式 cross-site 标记被拒（`packages/client/connection/src/api-request-trust.ts:57`）；围栏是可达性策略，不是认证层（client-connection README 说明）。

边界：Gateway 只分发一元方法，增量会话数据走同一条 Connection 上的独立命名流（api-gateway README 说明）。Client runtime 得到的是一组 remote service 调用描述与事件订阅，不复制 Host 服务实现——这与后端 RPC 客户端拿桩不拿实现的关系相同，差异在于事件订阅是单向推送、转发面由 Host 组装选择。

### 7.4 Web 是事实投影加控制面

Web 客户端持有的会话由 Host 创建（Session+Agent+cwd 一次 `session.create`），客户端不保存独立实体状态，只维护投影镜像（client-runtime README 说明）。每会话的 `ProjectionValueStore` 由历史尾 `projections` 块播种，`session/projection` 帧按更高 seq 覆盖更新；domain 模块经 `ctx.remote.$on` 订阅自己的事件，帧由承载方喂给 `$dispatch`（client-runtime README、api-gateway README 说明）。会话与工作区列表各有独立的 pending→ready 基线阶段，增量帧与重连基线都有确定的覆盖规则。

浏览器 UI 属于控制面：conversation、tool、trajectory、plan、goal、jobs、subagent 等模块行（web-app cordis.patch.yml:174-210）各自订阅对应投影并回发 RPC，会话语义与模型可见性仍由 Host 决定。prompt、selectModel、fork、rename 与分页 history（尾页带 projections 块）都经 `/api` 一元方法执行（host-apiproxy README 说明）。审批、计划评审、提问在客户端被归为 `pendingInteraction`，用于呈现与路由（client-runtime README 说明）。模型选择在会话运行前属于控制状态，一旦写入 request/header 就成为可从日志重建的会话事实（host-apiproxy README 说明）。

投影状态按连接代次（connection generation）作用域划分：断线清空，mux-open 重放只恢复仍 pending 的请求（client-runtime README 文档说明）。Gateway 自身也持有两个投影单元：`sessionListMetadata` 缓存列表的 blank 迁移与最近提示时间，`imageLimits` 发布附件配置的每 boot 常量（host-apiproxy README 文档说明）。

会话的事件窗口由 `ConversationNodeAssembler` 组装：插件注册 Definitions，把一个事件映射为稳定的 `{kind, id}`，State 在唯一起始事件处创建，后续关联事件折叠进去；实时 append 时每个 Definition 只求值一次，翻页加载旧页只对新前缀事件求值并重放受影响的 Context（client-runtime README 文档说明）。会话的待发队列投影 `ConversationSnapshot.queue` 镜像 Host 的 `agent.inbox.nextTurn`，编辑经 Host 侧 `Inbox.splice()` 提交，客户端不做乐观修改，下一次 Host 快照是唯一可见的落定（client-runtime README 文档说明）。客户端在 session 行进入列表镜像时才诞生对应 Agent 作用域，随 prune 消亡，本身不持有 pre-entity 会话状态。

交互答案在第一个认领前按 pending 请求校验，`claimQuestion` 的同步删除保证先答先得（`packages/host/apiproxy/src/api-proxy.ts:1357`）。审批等待点在 Host；断线重连时 mux-open 只重放仍 pending 的请求帧，已 resolve 的请求不会复活（`packages/host/apiproxy/src/api-proxy.ts:1411` 附近注释）。UI 显示“完成”本身不构成结果验证：它只反映会话状态，文件、命令或外部系统的最终结果要按各自路径复核（与第四章的 stdout 边界一致）。

### 7.5 自动化入口的所有权差异

三个自动化入口的差异集中在三件事：进程边界、等待边界与结果归属。

Headless 是一次性进程：runner 等 Agent idle、flush Session，把最后一条 assistant text 写到 stdout，再以 `completed → 0` 退出（`packages/bundle/headless/src/index.ts:127`）。退出经 launcher 提供的 `appExit` 请求，在进程树卸载后生效（`packages/bundle/headless/src/index.ts:50`），进程结束即所有权结束。

ACP 是 automation-only 的 JSON-RPC stdio 服务：`session/prompt` 等待整个 Agent idle 才 settle，每会话一个 in-flight 槽（`packages/acp/acp/src/index.ts:281`），只输出已提交的 assistant message 文本，原始增量不泄露；`session/cancel` 只取消被寻址的 agent，把其 pending prompt 记为 `cancelled`（`packages/acp/acp/src/index.ts:226`、`297`）。权限请求作为一次性 allow/reject 提供，客户端可按策略自动作答。客户端断开与 Cordis 卸载共享同一 teardown：先拒绝新 session/prompt、settle pending，再清理本连接所属的 agent（acp README 文档说明）。`initialize` 只广告 baseline-only prompt，不声明 session、editor、terminal、filesystem 或 MCP 能力；`session/new` 用绝对 cwd 创建新 agent，非空的 `additionalDirectories`/`mcpServers` 会被拒绝（acp README 文档说明）。

SDK 以子进程方式驱动完整 runtime：`run()` 拥有一个活动区间——队列 prompt 后等待消息 id 进入持久 `agent/inbox/spliced` 回执，再收集到下一次整 Agent idle；`finalResponse` 是该区间最后一条已提交根会话文本，不对输入做因果归属（`packages/sdk/client/src/api.ts:140`、`types.ts:61`）。`close()` 走 shutdown→EOF→SIGTERM→SIGKILL 阶梯，直到进程实际退出（sdk-client README 文档说明）。通知订阅可以按过滤条件或按 session 树收窄，运行时为上下文内每个 session 都发通知，收窄在客户端完成。`DeepSeekHarness` 的 `start()` 记忆 `initialize` 握手（cwd 解析、provider/model 路由），握手失败会回收 runtime 并用新客户端重试；子进程首次使用时惰性启动，`close()` 负责收割（sdk-client README 文档说明）。

三个入口默认都从新 agent 开始：Headless 每次运行创建新 agent（`packages/bundle/headless/src/index.ts:91` 注释），ACP 的 `session/new` 创建新 agent，SDK 的 `run()` 可指定 `sessionId` 或新建（`packages/sdk/client/src/api.ts:85` 注释）。复用已有会话需要显式传 id，并让 runtime 指向同一持久化后端——入口自身不隐式打开别人的会话。

边界：JSON-RPC 示例证明的是协议路径，不自动证明目标部署的认证、租户隔离与重连策略——这三项属于部署责任。

### 7.6 多入口一致性验收

本章结论：多入口的一致性由会话日志承担。各入口重建模型请求、投影与恢复时，读的是同一份 SessionEvent 序列；一致性验收按三栏划分：

| 必须共享 | 可以不同 | 不应共享 |
| --- | --- | --- |
| SessionEvent 顺序、request header、tool result、resume/fork 语义 | 输入协议、UI projection、连接生命周期、默认 profile、产品专属服务 | 浏览器瞬时状态、未领取 inbox、AbortController 与其他进程内控制对象 |

前两栏由第五章的日志事实直接支持：模型请求、工具结果与恢复都从持久日志重建，入口协议与投影是各自进程内的表达。第三栏是所有权边界：inbox 的未领取队列、AbortSignal 与 UI 本地状态在固定提交中都属于各自进程、各自 fiber，跨入口共享它们没有意义，也会破坏取消与撤销语义。

验收做法：对同一 session id，先确认各入口指向的持久化后端与 writer ownership 规则，再分别用 Web、Headless、ACP、SDK 读取，比较事件序列与投影结果。验收记录两件事：各入口读到的事件 seq 区间与 request header 是否一致；入口切换期间谁持有 active-owner。Web 与 Headless 是两个独立 live runtime（第三章），跨入口切换的 owner 协商在固定提交的默认组合之外。各入口一次操作的等待边界与结果归属也一并入账：

| 入口 | 一次操作的等待边界 | 结果归属 |
| --- | --- | --- |
| Headless | 进程生命周期 | stdout 文本与退出码 |
| ACP | 整 Agent idle | 已提交 assistant 文本 |
| SDK | inbox 回执 → 下一次 idle | 区间内最后一条已提交文本 |

固定提交内 Web 与 Headless 是两个独立 live runtime，各自持有自己的进程内状态；跨进程共享同一 session id 需要指向同一持久化后端并遵守 writer ownership——固定提交只显示读路径按 revision 稳定收敛、连续外部写入者可能延迟收敛（`packages/session/session-persistence-jsonl/src/index.ts:285`、`packages/session/session-persistence/src/index.ts:150`），多进程同写会话不在固定提交的证明范围内。

以下为采用建议，基于前三类证据的推论：若部署计划让多个进程共享同一持久会话，需要先定义 active-owner 协商与租约，再谈一致性验收；固定提交的单进程多入口组合不承担这一责任。

## 第八章 权限、安全与信任边界

本章沿“模型输出 → 工具策略 → 执行 provider → 外部副作用 → SessionEvent/遥测”建立威胁模型，把链路拆成五段信任边界，逐段记录机制、默认配置、部署责任与未验证项。链路的每一跳都能回到固定提交的默认组合或对应 provider，结论分“机制”与“运行态行为”两档，8.6 汇总。

```text
模型输出
  → 工具策略：schema 校验、scope 过滤、tools/pre-execute、monotonic guard、approval
  → 执行 provider：fs-sandbox / subprocess-local / bash-sandbox / 平台 runner / e2b
  → 外部副作用：文件写入、进程树、网络请求、凭据使用
  → 证据面：SessionEvent、附件、spill、遥测
```

### 8.1 工具策略链中的最终强制点

模型给出的 tool name/arguments 先过两层静态门：`dsh-tools` 把作者声明的 schema 编译成 raw JSON Schema 并对参数执行校验（`packages/core/tools/src/schema.ts` 的 `validateArgs`）；scope 层再按 agent 作用域过滤工具可见性，`ToolRestriction` 的 allow/deny 取交集，作用域注册与 Code Mode 保留通道不受限制过滤（`packages/core/tools/src/index.ts:677-701`）。

执行路径按五个阶段展开，每阶段能改变的东西不同：

| 阶段 | 事件/机制 | 能做什么 | 不能做什么 |
| --- | --- | --- | --- |
| 准入 | `tools/pre-execute` waterfall | 返回 `allow`/`deny`/`ask`；`next()` 委托为 allow | 改写参数（arguments 已先记录并呈现） |
| 最终强制 | monotonic guard | 返回拒绝原因或 undefined | 没有 allow 结果，一次拒绝不会被后置 listener 翻回放行 |
| 执行 | `tools/execute` waterfall | timeout、retry、metrics 包装 | 只能替换 `exec.signal`，调用身份不可变 |
| 结果 | `tools/post-execute` waterfall | 接受、替换投影、`block`（纠错反馈转错误结果） | 无 |
| 审计 | `tools/result` emit | 观察冻结的最终结果 | listener 失败被包含，不影响结果 |

表 8-1 工具执行五阶段（`packages/core/tools/src/index.ts:142-207`）。pre-execute 的 `ask` 缺少 approval 服务时变成拒绝（同文件 145）；取消信号在异步 gate 收敛后重新检查，但 gate 的 promise 不会被放弃（146-147）。

`ask` 阶段本身不授权，approval 服务只裁决这一跳。请求必须发生在 open turn 内，并在日志留下 `approval/asked` + `approval/decided` 审计对；结果只有 `allowed-once`/`rejected`/`cancelled`/`unavailable` 四种，answerer 缺失或抛错归为 `unavailable`，即 fail-closed（`packages/interaction/user-approval/src/index.ts:82,239-276`）。session 级 `approval/policy` 折叠为 `ask` 或 `never`，`never` 直接拒绝一切 ask，不进入提示（同文件 178-184）。

默认装配里，拒绝的最终强制点实际落在 provider 层，而非 listener 层。base 挂载的 `fs-sandbox` 在 provider 内部做 per-call containment，抛 `FS_SANDBOX_DENIED`；`tool-fs` 把它映射成模型可见的 `[sandbox: …]` 标记与升级提示（`packages/fs/tool-fs/src/sandbox.ts:110-130`）。模型若携带 `sandbox_permissions` + `justification` 重试，工具在“任何东西执行之前”走一次 `approveEscalation`：目标模式必须是当前模式严格更宽的集合成员（执行期检查，非 schema 约束），缺 approval 服务直接抛错，只有 `allowed-once` 才放行（`packages/sandbox/sandbox/src/escalation.ts:41,157-188`）。escalation 词汇由 fs 与 bash 共用，两条路径的拒绝语义一致。

取消的边界：调度器在取消后停止新 dispatch，已启动调用先收敛，剩余模型调用收到规范化的 aborted result（`packages/core/agent-loop/src/tool-calls.ts:237-242`）。工具体与 Harness 同进程，注册表保留调用方取消信号却无法硬杀同步代码；已发出的网络或第三方动作只能由工具按 `exec.signal` 协作补偿（第四章的 dispose 证明范围）。因此取消后仍可能有外部动作在收敛途中，这属于设计内边界。

缺少 policy/provider 时按各自语义失败：confining fs 已挂载但 `sandboxPolicy` 缺失，tool-fs 在构造期直接抛错（`packages/fs/tool-fs/src/sandbox.ts:47-49`）；approval 服务缺失时，pre-execute 的 `ask` 变拒绝、escalation 抛错（escalation.ts:165-167）；sandbox runner 不可用时 fail-closed，不把原始 argv 放行（8.2）。

### 8.2 文件与进程：策略声明不等于操作系统隔离

默认装配把权限声明与 OS 隔离分开：sandbox-policy 的 mode 决定文件操作面，approval preset 决定是否询问用户，两者由同一个 permission preset 绑定：

| mode | 文件操作面 | approval | 默认来源 |
| --- | --- | --- | --- |
| `read-only` | 读、搜索、查询；一切变更拒绝 | ask | preset（base/cordis.patch.yml:197-199） |
| `workspace-write` | 变更限 workspace 根与临时目录 | ask | 默认（base:200-202；mode 由 `DSH_PERMISSION_MODE` 决定，base:175） |
| `danger-full-access` | 不做围栏，原样执行 | never | 显式配置（base:203-205；approval 同源，base:191） |

表 8-2 权限模式 × 操作面 × approval（`packages/bundle/base/cordis.patch.yml:172-205`）。sandbox-policy 自身的 config 默认是 `read-only`，是 fail-safe 兜底；base 用 env 默认 `workspace-write` 覆盖它（`packages/sandbox/sandbox-policy/src/index.ts:62,94`）。会话的 `sandbox/mode` 事件写在模型历史里，replay 能重建同一 mode 与 root（同文件 8）；解析顺序是已批准覆盖 > session 最近一次 `sandbox/mode` > 部署默认（128-138）。

文件侧的强制在 `fs-sandbox`：`checkedTarget` 对 mutation 目标重新规范化（realpath 最深已存在祖先，捕捉并发替换的 symlink），要求落在 `writableRoots` 内——`workspace-write` 的写根是 workspaceRoot、`/tmp`、tmpdir 的并集（`packages/sandbox/sandbox/src/roots.ts:52-54`）——并返回新鲜目标，避免 check-here-write-there 的 TOCTOU（`packages/fs/fs-sandbox/src/index.ts:115-148`）。观测策略再加一层状态门：没有 fs-observation-policy 时工具保留 provider 的无条件变更行为；有了之后，edit 必须先读过目标（`FS_NOT_OBSERVED`），write 按观测版本做 CAS（`packages/fs/fs-observation-policy/src/index.ts:4-6,61-88`）。

进程侧的隔离依赖平台 runner，与文件策略无关。`sandbox-local` 在 Linux 上依次探测 bwrap 与 Landlock，macOS 用 Seatbelt，Windows 用 ACL restricted-token runner；找不到可用隔离时 fail-closed（`packages/sandbox/sandbox-local/src/index.ts:1-15`）。bash 工具把本地 bash 的精确 argv 送进该 runner（`packages/shell/bash-sandbox/src/index.ts:2`），默认 60s 超时（base:182）。subprocess 侧，每次 spawn 是独立进程树，环境做凭据擦洗；dispose 以 SIGTERM→宽限→SIGKILL 收敛进程组，Node 同步退出阶段强制结束仍持有的树（`packages/subprocess/subprocess-local/src/index.ts:2-5,33-34`）。

两个平台限制计入结论。Windows ACL 只做部分强制：`WRITE_RESTRICTED` 的 restricting list 必须保留 Everyone，NTFS hard link 会让一个文件对象跨路径别名（`sandbox-local/src/index.ts:7-25` 源码注释）。Landlock 老 ABI 会打印“部分强制执行”通知，事故复盘 0004 记录该通知曾被误归类为 launcher 失败（`docs/postmortem/0004-landlock-partial-notice-misclassified-child-failures.md`）；修复后 stderr 仍是带内归因通道，受限子进程可以故意复现 runner 的诊断行造成误归因——该路径削弱可用性与诊断，不改变约束本身。e2b 是实验性 provider 组合（POC），把 fs/subprocess 适配到远端 E2B Linux 沙箱，但 Harness 进程、Cordis 对象、模型调用与会话持久化都不进入该沙箱（`packages/e2b/README.md`），它引入的是“沙箱在远端”的信任假设。

### 8.3 凭据、启动环境与配置求值

凭据层把引用与真实值分开。credentials 提供方持有的是严格 `CredentialRef`→string 映射，从不把值物化进进程环境；来源优先级从高到低：继承的环境（只读、优先）、`$DSH_HOME/.credentials.yaml`（provider 管理、可写）、调用目录 `.env`、`$DSH_HOME/.env`（只读兜底）（`packages/credentials/credentials-local/src/index.ts:5-17,29-34`）。环境优先是因为 CI secret 或容器 `-e` 属于本次运行的显式意图，无法从进程内修改，必须可见地只读；Models 页只写 managed 文档，不写进程环境（base:83-84 注释）。

解析发生在请求时。llm 适配器把 `apiKeyEnv` 声明为 `CredentialRef`，每次生成从“本次请求的 connection 快照”解析 key，避免旧 generation 的 secret 配新 URL（`packages/llm/llm-deepseek/src/adapter.ts:55-58,218-221`）；key 只进 wire 的 `authorization: Bearer …` 头（275-284）。Web 的 Models 页为 pi-ai 提供 provider profiles，key 同样经 `apiKeyEnv` 引用按请求解析，profile 空时路由全部注销（base:88-94 注释）——适配器存在性与 provider 运行是两个组合层。写入 SessionEvent 的 `request/header` 携带 `LlmCallConfig`——provider、model、reasoningEffort、temperature、maxTokens、stop，字段表里没有凭据（`packages/llm/llm/src/call-config.ts:23-30`）。因此“请求真实配置”被记录，secret 留在 wire 层。

启动环境是快照，随后不可变。launcher 在 config entry 挂载前用各层内容构造 `launch-environment` 快照并记录来源层，复制每一层的内容，之后的变更不会改到快照（`packages/util/launch-environment/src/index.ts:2,74-79,105-109`）；配置表达式（`!!js`）与 shell 工具都按它解析。shell 工具的可见面更窄：`shell-env` 只提供受信任的、按执行枚举的 `DSH_*` 变量注册表（`packages/shell/shell-env/src/index.ts:1-16`），子进程环境另行做凭据擦洗。`--dump-config` 不求值 `!!js`（第三章），env 表达式以字面量输出；凭据在配置里以引用形式存在，dump 打印的是引用名而非解析值。

错误表面同样不含凭据：错误对象取 `HarnessError` 的 name/code 传播，`FS_SANDBOX_DENIED` 的结构化 code 保留在模型文本之外（`tool-fs/src/sandbox.ts:114-117`）。凭据是否进入自定义 adapter 的错误体或 Client API 属于验证门（8.6 表）；固定提交的默认装配，其日志与错误路径未显示凭据值。

### 8.4 会话、附件、spill 与遥测的数据路径

会话数据按“是否模型可见、是否可回放”分档。SessionEvent 落到 `$DSH_HOME/sessions` 的 JSONL（base:98-101）；SQLite 全文索引默认关闭——`openAt: never` 保留精确读取、标题与 lineage（含导出），搜索调用直接失败，SQLite 文件默认不创建（base:109-121 注释）。SQLite 侧有单调 `SCHEMA_VERSION`（当前 15），磁盘版本不兼容时直接报错拒绝打开，不自动迁移（`packages/session/session-persistence-sqlite/src/schema.ts:20,108-109`）。checkpoint 是写前屏障（第五章），只保证动作前缀耐久，不提供日志与外部系统的分布式事务。

大对象各有独立路径。附件字节存 content-addressed 对象库（`sha256`，`objects/<2>/<sha256>`），会话日志只放引用，provider 请求与授权历史读取都经该后端解析（`packages/attachment/attachment-local/src/store.ts:19-37`；base:103-107）。spill 把超过 `maxInlineBytes` 的纯文本工具结果存进 session-scoped 目录（`<root>/session-<sha12>`），模型看到 bounded 的头尾预览与 locator；spill 是 best-effort，保存失败不会把成功调用翻成错误（`packages/spill/spill-policy/src/index.ts:1-46`），默认根是 0700 私有 per-process 临时目录（`packages/spill/spill-local/src/store.ts:20,67-75`）。同一上限的第二支作用在 durable log：`tools/code-dispatch-log` waterfall 给 `run_code` 子调用的日志副本同样做 bound，程序收到的完整值不受影响。

遥测默认关闭。`session-telemetry-otel` 的默认 mode 是 `DISABLED`（`packages/session/session-telemetry-otel/src/index.ts:47-51`），base 用 `DSH_TELEMETRY_MODE` opt-in（FULL/FEEDBACK_ONLY，禁用时反馈留在本地）；默认装配没有 session-telemetry/record 脱敏规则，上传镜像的是 session-log 的原始副本（base:129-137 注释）。关闭不只是配置：`DSH_TELEMETRY_DISABLED` 非空（含 '0'/'false'）时启动器把该 row 置 disabled，配置层无法再开启它。上传路径带明确停机预算——shutdownTimeoutMillis 3000、exporter timeout 1000、单批 drain（base:140-147,152-161）。导出携带 harness home 的匿名用户 id——随机 UUID v4，存于 `$DSH_HOME/.anonymous-user-id`，删除文件即重置身份（`packages/identity/anonymous-user-id/src/index.ts:2-29`）。

读取面随入口扩大。session-query 默认只提供精确读取与标题（Web 侧边栏仅标题匹配），全文搜索需要部署显式改 `openAt` 与持久 path；导出与子 Agent 的 Workspace 继承依赖精确读取而不打开索引（base:109-116 注释）。UI、遥测、统计从同一 SessionEvent 取不同投影（第五章 5.3），新增投影必须声明水位与重放成本。

### 8.5 动态扩展与供应链边界

装配可以运行时扩展，来源决定信任级别。profile bundle 是普通 npm 包，manifest 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`；内置 bundle 从 dsh 安装目录解析，树外 bundle 经 `dsh plugin --profile <name> add <package>` 安装（`packages/bundle/README.md:5-13`）。安装后的 patch 与 base 走同一 `applyEntryPatches` 合并（第三章），bundle 可以新增 row、覆盖配置、挂载运行时插件。

插件代码是进程内 Cordis 函数，拥有当前 ctx 与全部已挂载服务；固定提交源码未显示把插件代码放入独立沙箱的机制。因此安装来源是供应链边界：包版本、构建产物与回滚材料进入发布审查；安装后的有效树可经 `--dump-config` 审计（第三章），bundle 升级造成的配置覆盖按 row 合并语义生效，属于可追溯的装配变更。

代码层的动态替换走模块 HMR（第二章）：缓存可恢复、旧插件尽力重建，但替换不保证外部副作用回滚。卸载只撤销注册的 effect，不会补偿已完成的网络调用、文件写入或第三方事务——这是 Cordis 所有权模型的边界，与执行 provider 的收敛能力无关。Client module 运行在浏览器进程，经 Host—Gateway 协议访问能力，其读取面由连接与 API remotes 划定（第三章 Web 装配）；远端 provider（如 e2b）则把文件与进程的执行世界移到沙箱之外，信任假设随 provider 来源变化。

### 8.6 当前可以声称和不能声称的安全结论

机制由固定提交确认，运行态行为取决于部署环境、平台与 provider。每项主张写条件、证据、失败模式与验证门：

| 主张 | 条件 | 证据（固定提交） | 失败模式 | 下一验证门 |
| --- | --- | --- | --- | --- |
| 工具准入链存在，deny 单调、fail-closed | 调用走 registry 管线 | pre-execute/guard/execute/post-execute 契约（tools/src/index.ts:142-207,703-711）；approval `unavailable` fail-closed（user-approval:239-276） | 插件绕过 registry 直呼 provider；后置 listener 尝试翻回放行（guard 无 allow 结果可挡） | 组装后入口重放拒绝/超时/取消/撤销四类故障实验 |
| 文件写受 workspace 约束 | `workspace-write` 模式 + fs-sandbox 挂载 | `checkedTarget` 新鲜规范化与 containment（fs-sandbox:115-148）；`writableRoots`（roots.ts:52-54） | symlink 在规范化后交换；写根含 `/tmp` 与 tmpdir，存在跨写根别名 | 目标环境做 symlink 竞态与跨根写实验 |
| OS 级隔离由平台 runner 提供 | 平台 runner 可用 | sandbox-local 探测与 fail-closed（sandbox-local:1-15）；Windows ACL 部分强制注释（7-25） | 老 Landlock ABI 部分强制执行；ACL 保留 Everyone、NTFS hard link；runner 诊断行可被伪造（postmortem 0004） | 目标内核/平台实测约束与告警归因 |
| 进程树可收敛 | 子进程由 subprocess 服务拥有 | 进程组 SIGTERM→SIGKILL + 退出阶段强制终止（subprocess-local:2-5,33-34） | 不配合的孙进程、持久终端、外部服务调用 | 取消后进程残留检查 |
| 凭据不落会话日志与 wire 之外 | 默认装配与默认 adapter | `LlmCallConfig` 无凭据字段（call-config:23-30）；key 只在 wire 头（adapter:275-284）；store 不进环境（credentials-local:29-34） | 插件自行打印或转发凭据；自定义 adapter 把凭据写进错误体 | 审核错误对象、Client API 与自定义 adapter |
| 遥测默认关闭且有最后禁用层 | 默认装配 | mode DISABLED（session-telemetry-otel:47-51）；launcher 禁用层（base:129-137） | `DSH_TELEMETRY_MODE` 误配置；无默认脱敏，导出为原始副本 | 部署时核对 telemetry mode 与导出内容 |

表 8-3 可声称/条件/证据/失败模式/验证门。

不能从以上证据推出的结论：沙箱不可逃逸、租户隔离、合规认证。覆盖率门禁是逐文件 100%（仓库说明），只证明测试覆盖的路径；类型、单测与覆盖率都无法证明未覆盖的逃逸面为空。开发者预览、平台差异（Windows 部分强制、Landlock ABI）以及未在真实环境跑过的 provider（e2b、自定义 runner）必须作为条件保留。对每一项“机制已确认”的主张，运行态结论的验证责任在部署方与 provider 提供方：机制边界由固定提交给出，剩余风险由目标环境实验收敛。

# 第四篇 证据与采用

## 第九章 工程可信度与维护成本

前八章建立的机制判断，都要回答同一个问题：证据能支持多强的结论。这一章把主张分级、把仓库门禁映射到证据等级、把“外部世界验证”作为 Agent 结果的底线，最后给出当前基线的可复现证据包。素材来自固定提交的 `docs/testing.zh.md`、根 `package.json` 脚本、invariants 包与 postmortem 目录，分实现事实与官方文档两级记录。

### 9.1 先给主张分级，再选择测试

固定提交的测试策略按证据强度分层，主张与测试必须对齐层级（`docs/testing.zh.md:9-13`）：

1. **类型/接口存在**：声明与类型检查可证明，只支持“接口存在”。
2. **路径可达**：单元测试与装配测试证明调用路径存在。
3. **组装可运行**：Loader 组合测试与构建产物冒烟证明组装能启动。
4. **外部结果正确**：带密钥的真实 API e2e 加外部世界复核证明。
5. **长期运行可靠**：只有生产记录或长期实验能支持，单测、覆盖率与快照都到不了这一级。

设计文档支持设计意图，源码支持实现事实，单测支持局部契约，快照支持协议与呈现，真实入口与真实 API 支持运行行为，生产记录支持长期结论。每一级都不能替代更上级。第 1—8 章的核心判断在附录 D 按“已确认 / 条件成立时确认 / 待验证 / 不能推出”登记；比较章节的外部项目使用同一证据门槛，对 DSH 不放松标准。

### 9.2 仓库门禁分别证明什么

| 门禁 | 命令 | 能证明 | 不能证明 |
| --- | --- | --- | --- |
| 单元测试 | `pnpm run test` | 局部契约、边界、错误路径、事件顺序、并发竞态；每个注册表有 HMR 安全测试（对贡献 fiber 执行 dispose 并断言清理完成） | 产品组装与真实 provider 行为 |
| 覆盖率 | `pnpm run test:coverage` | 对 `packages/*/*/src` 按文件 100% 的行执行覆盖 | 功能按交付预期工作（官方文档明示行覆盖率是必要条件，不是充分条件） |
| 真实 API e2e | `pnpm run test:e2e` | 带密钥的真实 provider 调用（模型、搜索、抓取各 provider 冒烟） | 缺密钥自动跳过，跳过项不构成证据 |
| 快照 | `pnpm run test:snapshot` | keyless 固定协议、transcript 与持久日志；ACP 启动真实服务器回放录制会话 | 真实模型行为与目标部署 |
| Web 浏览器快照 | `pnpm run test:web` | Chromium 回放浏览器输出与 `apps/web/tests/snapshots/` 比较；CI 强制只读 replay | 后端真实 provider |
| 构建产物冒烟 | `built-bin.e2e.ts`、`built-lib.e2e.ts` | `bin` 运行构建后的 `lib/bin.js`，暴露 tsx 会掩盖的结算竞态与加载失败；真正缺失的配置以非零状态退出 | 外部副作用正确 |
| 静态与卫生门禁 | `check:ci:static`、`knip`、`publint`、`hygiene` | 死代码、依赖声明、打包与 NodeNext 消费 | 运行行为 |

`docs/testing.zh.md:35` 明确“真实入口路径”指已发布的构建产物，不加载 Cordis 的协议与操作系统 fixture 直接跑 Node，测试解析一律指向 `src`，构建产物只在显式指定时使用（`:37-39`）。

### 9.3 Agent 结果必须由外部世界验证

工具结果与业务完成证据是两回事。`docs/testing.zh.md:29` 给出的规则：e2e 断言应重新运行命令或从外部重新读取文件；对 agent 自身输出做关键词探测会让作弊的 agent 通过；未修改的文件逐字节一致。落到贯穿任务上：

- 文件修改后重新读取并比对未修改文件；
- 命令任务重新运行命令，用外部结果判定完成（agent 文本不作完成证据）；
- tool result、Agent 文本与业务完成证据分开保存——SessionEvent 记录的是“调用被记录”，外部世界验证的是“调用确实产生了预期效果”（与第五章的证明范围一致）。

mock 只用于高成本或不确定的边界（LLM 适配器、网络、时钟），下游保持真实（`docs/testing.zh.md:23`）。对网络写入或非幂等动作，记录幂等键、外部状态查询与人工复核方式；重启恢复后的 outcome unknown 必须按第五章的方法核验，不能盲目重试。

### 9.4 不变式、文档门禁和 postmortem 的证据价值

invariants 包是运行时不变式注册表：每个工作区包从 `./invariant` 伴生文件注册检查，注册表负责选择、唯一性与子 fiber，失败带包归属（`packages/runtime-diagnostics/invariants/src/index.ts:1-22`）。不变式检查的是可观察的事件/数据关系，不检查“服务方法是否存在”；没有可检查关系的包给出带包名的空理由。它能证明受管关系在运行中成立，不能证明业务正确性。

文档门禁降低接口漂移：`verify-md-wrap`、`verify-md-links`、`doc-typecheck`（含 `ts type-equiv` 逐字类型对账）与 `verify-doc-refs` 把文档与源码绑在一起，但只证明文档与代码一致，不证明实现正确。

postmortem 是失效记录的证据档：固定提交里已有 0001（ACP 默认导出丢 inject——单元测试全绿但产品装配坏的实例）、0002（`!!js` 表达式禁用文件系统工具）、0003（Web Agent GUI 反馈回路）、0004（Landlock 部分强制执行通知被误归类为 launcher 失败）。postmortem 证明团队记录过具体失效与修复，不证明同类问题不会复发。已有事故可映射回本书边界：0001 落在第七章的协议与装配面，0004 落在第八章的沙箱强制面。

### 9.5 可组合架构的维护半径

可替换能力减少 consumer 分叉，同时把维护成本转移到 seam contract 与组合测试矩阵（第六章的验收标准）。一项变更的半径按可见性分层：

- 模型可见变更：tool schema、system prompt、request header 字段——改动会触碰所有入口的快照与 transcript fixture（`docs/testing.zh.md:47` 要求同一 PR 更新无密钥场景）。
- 协议可见变更：Typert schema、事件类型、SessionEvent 词汇——未声明 `ignorable` 的新增 required event 会让旧 reader 拒绝恢复（第五章），改动必须同步 schema 版本策略。
- 人类可见变更：UI 投影、呈现模式、CLI 输出——落在 Web 快照与 ACP 快照套件。

package 数量只作为可复现现场统计，不作为模块化质量指标（附录 D 的数量行只描述装配差异）。RC/开发者预览阶段要重点记录 schema、配置、插件生命周期与发布产物的升级风险：SessionEvent 仍是 format `0` 且注释明确不承诺兼容迁移，SQLite 用单调 `SCHEMA_VERSION` 且磁盘版本不兼容时直接拒绝打开、不自动迁移（第八章 8.4）。

### 9.6 当前基线的可复现证据包

可复现证据包按固定顺序记录，每项注明条件与缺口：

1. 环境基线：固定 Node/pnpm/OS、提交 SHA `47f943859bef`、环境能力（pwsh 是否可用、wine 车道）与凭据是否存在。
2. 静态检查：typecheck、lint、knip、publint、hygiene、文档门禁的结果。
3. 单元测试与覆盖率：按文件 100% 的执行结果，pwsh 缺失时其执行器套件自动跳过并有豁免记录。
4. 快照：keyless ACP/headless 回放与 Web 浏览器快照。
5. 构建产物冒烟：built-bin/built-lib 在构建后的 `lib/` 上运行。
6. 真实 API：带密钥 e2e 的自跳过记录——自动 skip 必须列入缺口，不能记为通过。

写作仓库自身没有安装依赖，未在本轮重跑上述门禁（附录 D 相应行已注明）；因此本章 9.2 的表格记录的是固定提交的门禁配置与官方文档定义，运行结果留给第 11 章试点前的目标环境复现。证据包应保存有效配置、SessionEvent、文件 diff、进程收敛与失败日志，供第 11 章阶段门使用。

## 第十章 DSH 在真实 Agent 技术栈中的位置

### 10.1 比较方法：先读控制流，再谈功能

首轮比较固定五个提交，并检查以下代码路径：

1. 谁拥有主循环或调度循环。
2. 模型输入从什么状态派生。
3. 工具调用在哪里解析、审批、执行并写回。
4. 中断、恢复和持久化以什么结构表达。
5. 新能力通过对象参数、hook、provider、节点还是插件树接入。
6. 项目交付的是产品、SDK、编排引擎还是运行时平台。

比较不使用 GitHub 星数、包数量、宣传用例或笼统的“支持某功能”作为架构结论。一个接口若在固定提交中直接抛出未实现错误，只能记为设计中的表面，不能记为已交付能力。

### 10.2 Codex：产品级运行时

Codex 的核心是一个产品级 `Session`。源码注释明确规定一个 Session 同时最多运行一个 task，但用户输入可以中断它。`RegularTask` 启动 `run_turn`；如果当前 active turn 的输入队列仍有内容，它继续运行下一轮。`run_turn` 内部持有模型 client session、上下文、输入队列、compaction、hooks 和工具路由，并围绕 `needs_follow_up` 继续采样。

这套结构已经覆盖 Coding Agent 产品需要的大量问题：

- Session 与 Turn 生命周期；
- 用户运行中追加输入；
- 工具注册、路由和取消；
- 自动压缩与 token window；
- 审批、沙箱、MCP、skills、插件和多 Agent；
- rollout 与 UI 协议事件。

它和 DSH 的差别不在“有没有插件”或“有没有事件”。差别在主架构的所有权：Codex 的 Session/Turn 是围绕一个具体编码产品构造的中心，工具、状态和产品协议与它紧密协作；DSH 则把默认 Agent Loop、LLM、工具、会话和执行环境分别注册为 Cordis 服务，希望从配置层替换整段能力。

因此，若目标是直接使用成熟编码产品，DSH 与 Codex 属于不同层级。若目标是构建自己的多入口 Agent 平台并允许 Codex 作为一种外部委派能力，DSH 的 `subagent-codex` provider 才是更贴近其架构定位的关系。

不能从源码推出的结论：DSH 比 Codex 更安全、更稳定或更易维护。Codex 的集中式产品内核可能更适合统一优化；DSH 的拆分是否带来收益，要看团队是否真的替换这些边界。

### 10.3 Pi：低层循环已经可用，新 Harness 仍在形成

Pi 当前代码不能只用“轻量 Agent Loop”概括，因为仓库正在增加 durable session 与 `AgentHarness`。需要把两个层次分开：

**已工作的低层路径。** `agentLoop` 和状态化 `Agent` 以 `AgentMessage[]` 为上下文，通过 `streamFn` 调模型，执行 tool calls，并用 `getSteeringMessages`、`getFollowUpMessages`、`transformContext`、`beforeToolCall` 和 `afterToolCall` 等回调扩展行为。这是清晰的嵌入式 Agent Core。

**正在形成的新路径。** 仓库已经定义 Session entries、operation records、lane、reducer 和 `AgentHarness` 接口，意图支持 durable operation、恢复、分支和手动驱动。但在固定提交中，`AgentHarness.create()` 遇到已有 record 会抛出 `HarnessNotImplemented("create.restore")`，`prompt()`、`resume()`、`waitForIdle()`、`executeAction()` 等核心方法也仍返回 `HarnessNotImplemented`。

所以当前能够成立的比较是：

- 需要尽快把循环嵌入 TypeScript 应用时，Pi 的低层 API 更直接，概念和部署表面更小。
- 需要现成的统一 SessionEvent、Profile/Bundle、多入口 host/client、能力 provider 与卸载生命周期时，DSH 已经提供更宽的运行时结构。
- 不能把 Pi 新 Harness 的接口目录当成已经运行的完整能力，也不能假设它未来实现后仍与 DSH 保持现在的差异。

DSH 的 Pi adapter 使用的是模型接入层 `pi-ai`，这不意味着 DSH 继承或运行 Pi 的完整 Agent Harness。模型适配器复用与 Agent 运行时复用必须分开表述。

### 10.4 OpenAI Agents SDK：应用 SDK 的 Runner 与可恢复 RunState

OpenAI Agents SDK 的公共入口是 `Runner.run()`、`run_sync()` 和 `run_streamed()`。内部 `AgentRunner` 维护一个 `while True` 控制流：准备输入和 Session，执行 input guardrails，准备 sandbox，调用模型，处理 tools、handoffs 或 final output，并在需要时再次运行当前或新的 Agent。

这个 Runner 已不只是一个最小循环。固定提交中可以确认：

- Agent、tools、handoffs、input/output/tool guardrails 和 lifecycle hooks；
- `RunState` 中断后恢复；
- 本地 Session 与 OpenAI server-managed conversation 两种历史路径；
- sandbox session 准备与清理；
- 每个 turn 的持久化和最终输出保存。

它与 DSH 最明显的结构差异在扩展和事实模型。Agents SDK 主要通过 Python 对象、`RunConfig`、hook、tool 与 Session protocol 组合应用。基础 Session protocol 的核心是 `get_items`、`add_items`、`pop_item` 和 `clear_session`，存储的是 conversation input items；Runner 另行维护生成项、model responses、guardrail 结果和可恢复 `RunState`。

DSH 则要求 Turn、Step、请求头、assistant chunk、tool call/result 等进入可扩展的 typed SessionEvent 流，并从该日志派生模型消息。它的目标还包括由 Profile/Bundle 组装 Web、Headless 和其他入口。

选择含义：

- 已有 Python 服务，希望以代码方式组合 Agent、handoff、guardrail 和 tools，Agents SDK 的采用路径更短。
- 需要把模型、工具、执行世界、会话和 UI 作为可独立提供与卸载的运行时能力，DSH 的抽象更贴近问题。
- Agents SDK 已具备 sandbox、恢复和 session，不能再用“只有简单 handoff”描述它；真正的差异是平台组装模型，而非单项功能有无。

### 10.5 LangGraph：图状态编排与 Agent 运行环境是两层问题

LangGraph 的核心是 `StateGraph` 编译出的 Pregel 图，并不绑定在固定模型—工具循环上。节点读取状态并写入 channel；Pregel loop 以 superstep 推进任务，把 writes 写入 checkpointer，在节点前后触发 interrupt，并通过 checkpoint 与 `Command(resume=...)` 继续执行。

这使 LangGraph 对以下问题表达得更直接：

- 有显式拓扑的长运行流程；
- 多节点并行与 channel 合并；
- 节点级 retry、timeout 和 error handler；
- checkpoint、time travel、interrupt 与 human-in-the-loop；
- 子图和跨图 Command。

DSH 的默认 Agent Loop 没有要求用户先画一张图。它围绕 inbox、Turn、Step、模型与工具 continuation 推进，并把 workflow engine 当成运行时中的一项能力。相应地，DSH 默认带有文件、Shell、沙箱、审批、凭据、会话、Web/Headless 装配等 Coding Agent 运行环境，而 LangGraph 的图本身不替应用决定这些具体能力。

两者可以互补：LangGraph 负责跨步骤、跨 Agent 的显式业务流程，DSH 或其他运行时负责每个 Agent 节点内部的模型、工具、权限和执行世界。若团队真正的问题是 DAG、持久工作流和人工中断，先选图引擎比先引入完整 Coding Agent runtime 更合理；若问题是多个产品入口共享同一 Agent 执行环境，只有图还不够。

### 10.6 同一任务的逐步对照

以“读取项目—提出修改—审批后写文件—运行测试—中途 steer—持久化并恢复”为例：

| 环节 | DSH | Codex | Pi 低层 Agent | OpenAI Agents SDK | LangGraph |
| --- | --- | --- | --- | --- | --- |
| 启动 | Profile/Bundle 生成插件树并创建 Agent | 创建产品 Session 与 task | 应用构造 Agent、model、tools | 应用构造 Agent 并调用 Runner | 应用编译 StateGraph |
| 状态推进 | inbox → Turn → Step | input queue → task → turn → sampling loop | message array → assistant → tool loop | Runner turn → tools/handoff/final | Pregel superstep → node writes |
| 工具执行 | `ctx.tools` waterfall + guard + provider | ToolRouter/Registry + 产品权限与沙箱 | `AgentTool.execute` + before/after callback | tool runner + tool guardrails/sandbox | 由节点或预构建 Agent 节点负责 |
| 中途输入 | followup/steer/inject 有不同目标 | active turn input queue | steering/follow-up queue callback | 主要通过中断 RunState 后恢复或新的 run 输入 | interrupt + Command(resume/update) |
| 持久事实 | typed SessionEvent，模型消息从日志投影 | rollout/protocol events 与 Session history | 低层 Agent 以消息状态为主；新 durable harness 未完成 | Session items + RunState/model responses | channel checkpoint + pending writes |
| 恢复 | session persistence provider 加载日志并 resume | 从 rollout/thread 状态恢复产品会话 | 低层需应用负责；新 Harness 目标接口尚未完成 | Session 历史或序列化 RunState | checkpointer + thread/checkpoint id |
| 能力替换 | Cordis service/provider 与配置 patch | 产品内部注册表、配置、hooks/plugins | 回调、工具数组、stream function | Python 对象、RunConfig、hook、tool/session protocol | node、channel、checkpointer、store |

表中“不同”不等于“较弱”。例如 LangGraph 没有内建 Coding Agent 的文件工具，是因为它处在另一层；Codex 没有把核心循环做成 Cordis 插件，也不妨碍它作为产品交付完整能力。

### 10.7 采用判断

以下判断属于采用建议，是基于前三类证据的推论；源码证据本身不直接支持这些结论。

从现有栈出发，选择路径可以压缩为四问：

1. **只缺一个可嵌入 Agent Loop 吗？** 优先评估 Pi 或 Agents SDK 一类更窄的核心。
2. **缺的是显式、持久、可中断的业务编排吗？** 优先评估 LangGraph；不要让 Coding Agent runtime 代替工作流建模。
3. **缺的是可直接使用的编码 Agent 产品吗？** 评估 Codex 等产品，自行建设平台是更重的投入。
4. **缺的是多个 Agent 产品共享的可替换运行环境吗？** DSH 才进入核心候选，但必须通过 provider 替换、会话恢复、拒绝路径和多入口一致性试验来证明价值。

首轮源码比较不支持“DSH 全面优于这些项目”的结论。它支持的更窄判断是：DSH 的差异化命题位于运行时组装和统一事实层；是否值得采用，取决于团队有没有这一层的真实问题。

完整提交、文件定位和结论范围见[附录 D]({{ '/appendices/sources-and-evidence/' | relative_url }})。

## 第十一章 采用路线

前几章确认了机制与边界，这一章把它们转成一套可以随时撤出的试点。核心原则：不把“成功跑出一次回答”当作采用结论；每一阶段只解锁下一阶段所需的最小数据、网络、凭据与插件权限。以下为采用建议，基于前三类证据的推论。

### 11.1 先定义边际价值与对照组

试点从第十章的真实替代方案里选对照组：现有 Coding Agent、轻量 SDK、LangGraph 或自研 Loop。每项假设写成四元组：“现有流程缺口 → DSH 机制 → 可观察改进 → 允许增加的成本”。至少验证两项真实需求——多入口共享会话事实、provider 替换、统一副作用控制或恢复审计。只有单入口和单 provider 的团队，不把“未来可能平台化”当作当前收益。

### 11.2 贯穿试点的最小验收任务

固定一个有缺陷的小仓库、模型输入、权限 preset 和预期文件/测试结果，沿用全书的贯穿任务。任务覆盖读取、审批写入、运行测试、中途 steer、取消、resume 与最终外部核验（第四、五章语义）；保存有效配置、SessionEvent、tool call/result、文件 diff、测试输出与进程树状态（第九章证据包）。同一任务在基线方案与 DSH 上各跑一遍，比较变更半径、恢复信息与运行责任，不只比较耗时。

### 11.3 四阶段 Gate

| 阶段 | 内容 | 进入条件 |
| --- | --- | --- |
| 一 | 隔离 Headless、固定 profile、无生产数据；证明执行链、日志重放与 bounded shutdown | 无 |
| 二 | 故障与替换实验：切换模型/执行 provider，注入拒绝、超时、取消、崩溃与依赖消失 | 阶段一通过 |
| 三 | 接入组织模型网关、凭据、存储、沙箱、遥测与备份；完成安全与恢复评审 | 阶段二通过 |
| 四 | 有限用户与第二入口；只在前三阶段达标后评估 Web/ACP/SDK；subagent/workflow/dynamic plugin 分别审批 | 阶段三通过 |

拒绝、超时、取消与 provider 消失四类故障实验放在阶段二，对应第八章 8.6 表的验证门；每阶段只解锁下一阶段所需的最小数据、网络、凭据与插件权限。

### 11.4 指标必须有分母和采集方式

- 可回放率：抽样任务中能从持久事实重建关键输入、请求和结果的比例（第五章）。
- 副作用收敛：取消/失败后遗留进程、未配对 tool result 与 outcome unknown 的数量（4.5、8.2）。
- 替换收益：切换 provider 时 consumer 代码、配置、快照与产品入口的修改量（第六章）。
- 入口一致性：同一 session 在两个入口上的事件水位、消息投影与恢复结果一致率（第七章）。
- 维护成本：升级修改文件数、组合测试时间、故障定位时间与回滚恢复时间（第九章）。
- 指标阈值由目标环境在试点前填写，正文不虚构通用合格线。

### 11.5 Go / Hold / Stop 与回滚

- Go：核心假设达到预设阈值，安全阻断与恢复演练通过，责任人接受长期运行成本。
- Hold：价值存在，但真实 provider、目标 OS、第二入口或升级证据仍缺失；明确补证期限。
- Stop：复杂度无可测收益、控制点无法 fail-closed、外部状态不可核验，或团队没有生命周期维护能力。
- 回滚材料：旧入口、配置快照、依赖锁、数据导出、SessionEvent schema、provider adapter 与操作手册。
- 退出设计优先保留会话事实、工具契约与业务接口，不要求继续保留 Cordis 插件树。

### 11.6 角色责任与签字证据

试点计划把责任划给四类组织角色，作为实施模板：架构师负责边界、替代方案与保留/退出设计；技术负责人负责阶段门、资源投入与 Go/Hold/Stop 决定；基础设施工程师负责环境、权限、存储、遥测、故障演练与回滚；开发者负责实现、provider 替换、测试、diff 与可复现记录。每次升级附证据路径与未覆盖条件，不接受只有结论的“已验证”。Go/Hold/Stop 记录模板包含决定日期、责任人、证据路径、未覆盖条件与复审触发器，与 12.6 复用同一组字段。

## 第十二章 结论

全书在此收束。本章不再增加新项目、新功能或新安全主张：12.1 汇总前八章已建立的事实，12.2—12.5 是推论与选择建议，12.6 给出判断的有效期。

### 12.1 已由固定提交建立的技术事实

| 事实 | 建立章节 |
| --- | --- |
| Agent Loop 是可替换 Service；Cordis Fiber/effect 管理声明过的进程内生命周期 | 第 1、2 章 |
| provider 变化驱动 consumer 卸载和恢复；HMR 的覆盖范围止于插件树与模块缓存 | 第 2 章 |
| Turn/Step、请求配置、消息与工具结果进入 append-only SessionEvent，模型上下文由其投影 | 第 4、5 章 |
| Profile/Bundle 把 Web 与 Headless 组装在共享核心之上；dump 可审计结构，但求值前与 live boot 补丁不在其中 | 第 3 章 |
| 能力 seam 由 Definition/Provider/Consumer 组成，注册原子、冲突 fail loud、卸载可撤销 | 第 6 章 |
| 多入口共享会话事实，协议、投影与进程内状态归属各自独立 | 第 7 章 |
| 工具策略链 deny 单调、审批 fail-closed；沙箱与平台 runner 是条件性隔离 | 第 8 章 |

这些事实证明架构机制存在，不自动等于规模化生产收益已经成立——证据分级见第九章。

### 12.2 DSH 的边际价值成立条件

以下为采用建议，基于前三类证据的推论：

- 至少两个入口必须共享同一会话事实（第七章验收）。
- 模型、文件系统、进程或沙箱 provider 确实需要独立替换（第六章）。
- 组织愿意统一管理工具策略、审批、凭据、持久化与恢复责任（第八章）。
- 团队能维护 Cordis 生命周期、配置树、协议/事件 schema 与跨入口测试（第九章维护半径）。
- 任一条件缺失时，复杂度成本可能高于动态组合收益。

### 12.3 按现有技术栈选择

以下为采用建议：

| 现有栈 / 需求 | 选择 |
| --- | --- |
| 需要直接使用成熟 Coding Agent 产品 | 优先评估 Codex 一类产品；DSH 只在需要自建运行时边界时进入 |
| 只需嵌入模型—工具循环 | 优先 Pi 或 OpenAI Agents SDK 一类更窄构建层 |
| 核心问题是显式长流程、checkpoint 与 time travel | 优先 LangGraph 一类编排层，可与 Agent 运行环境组合 |
| 已有运行时只缺权限、观测或交付流程 | 先补治理与基础设施，不因功能更多而整体迁移 |
| 真正需要多入口、可替换 provider 与统一事实 | 进入第十一章隔离试点，不直接生产采用 |

### 12.4 仍需目标环境证伪或证实的主张

- 动态组合是否降低团队总维护成本（第九章成本项）。
- 目标 OS/沙箱/provider 下的隔离、取消与资源收敛（第八章条件）。
- 真实模型、网络与存储条件下的性能、稳定性与容量。
- Web/ACP/SDK 多入口的认证、租户隔离、断线恢复与升级兼容（第七章边界）。
- 社区维护、发布节奏与长期 API/schema 稳定性（SessionEvent format `0`、SQLite `SCHEMA_VERSION` 的兼容立场）。

### 12.5 即使不采用也可保留的设计原则

1. 模型可见状态从持久事实派生，避免 UI、模型上下文与恢复各持一份真相（第五章）。
2. 工具副作用在策略、审批、执行 provider 与结果提交之间设明确边界，让拒绝路径可审计（第六、八章）。
3. 每项注册返回 disposer，把取消、等待收敛与外部补偿分开设计，让卸载可验证（第二章）。
4. provider/consumer 通过稳定契约连接，替换测试同时检查错误、事件与产品呈现（第六、九章）。
5. 用固定提交、真实入口与外部结果支持结论，证据强度与主张一致（第九章）。

### 12.6 最终判断的有效期

- 结论绑定 DSH 固定提交 `47f943859bef`、目标环境、试点数据与已审计的对照项目（第十章）。
- Go/Hold/Stop 注明决定日期、责任人、未覆盖条件与下一次复审触发器（与 11.6 同一模板）。
- 上游版本、默认 bundle、SessionEvent schema、安全 provider 或产品入口变化时重新核验。
- 未完成第十一章目标环境试点前，最高结论是“值得隔离验证”，不能写成“建议生产采用”。

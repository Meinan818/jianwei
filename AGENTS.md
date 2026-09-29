# 简味点单 — AI 编程助手交接文档（AGENTS.md）

> 本文件是项目的**唯一权威交接说明**。仓库内旧的 `README.md`（仅技术规范）与本文件冲突时，以本文件为准。
> 你（AI 编程助手，如 Codex / Claude）看不到原开发对话，所有上下文都在本文件和 `docs/`、`supabase/` 中。请先完整读完本文件再动手。
> **⚡ 如果你是接手开发的第一步：直接跳到第 0 节「多 AI 协同开发协议」**，先确认轮值锁，再读其余部分。

> **品牌名约定（2026-09-27 用户拍板）**：对用户展示的品牌是「**饭否外卖**」（网页标题、启动页、三端设置页、用户协议、示例店铺名都用它）；
> 「简味点单 / jianwei」只是**项目代号**，继续用于文件夹名、GitHub 仓库名、本文件名与内部文档。
> 品牌名与版次集中在 `src/data/app-meta.ts`，不要在页面里再写死。

---

## 0. 多 AI 协同开发协议（2026-09-29 新增 · 每次开工第一件事）

> 本项目由 **Claude** 与 **Codex** 两个 AI 轮流开发。你可能是其中任何一个。
> **开工前必做**：读本节 → 读 `.workbuddy/coop/state.json` → 确认轮值锁。

> ### ⭐ 用户最看重的是什么（2026-09-29 明确说明，任何时候不许破坏）
>
> 用户原话：**"喜欢你们两个之间这种执行任务的方式，令我不会不知道自己要干嘛。"**
> 他看重的是**机制**（永远知道下一步），**不是语气**。三条核心：
>
> 1. **同一时刻只有一个 AI 干活** —— 不是自己的班就**直接拒绝开工**并告知用户，不靠他盯着。
> 2. **干完活必须主动指路**（§0.5 强制）—— 汇报末尾必须有「—— 下一步 ——」，漏了就算没汇报完。
> 3. **交接靠死文件不靠记忆**（§0.2 + `BATON.md`）—— 隔多久回来读文件就能接上。
>
> **判据**：新增任何机制前先自问——这是让用户更清楚下一步，还是让他更迷糊？
>
> ### 另一条通用要求：主动提醒换模型
>
> 用户判断不了"这个任务值不值得用贵模型"，**由 Claude 判断并主动提醒**
> （完整规则见 `~/.claude/CLAUDE.md` 的「主动提醒换模型」一节）。
> 该提醒的场景：重大架构/技术选型决策、疑难 bug 试了 2 次以上没定位到根因、代码审查任务。
> 简单任务在用贵模型时，反过来提醒可以切回便宜模型省钱。
> **不要每次都提**——只在上述情况提，否则变噪音。

### 0.1 铁律：同一时刻只有一个 AI 改代码

两个 AI **互相看不见对方的对话**，唯一的通信媒介是 **本仓库的文件 + git**。
因此**同一时刻只能有一个 AI 在改代码**，否则必然互相覆盖。

- 开工前读 `.workbuddy/coop/state.json`，看 `holder` 字段。
- `holder` 不是你自己 → **不要改代码**，向用户说明"现在轮到 X，请先让它交接"，然后停止。
- `holder` 是你自己 → 可以开工。
- `holder` 为 `none` → 无人接管，你可以认领（把它改成自己）。

### 0.2 换班流程（三步，由交出方执行）

1. **先干完再交**：手上的活干完、自测通过（对照 §8.1 的验证要求）、`git commit` 存档。
   严禁把半成品交出去。
2. **改写轮值锁**：把 `state.json` 的 `holder` 改成接手方，更新 `since` / `branch` / `task` / `nextCheckpoint` / `updatedAt`。
3. **追加交接记录**：在 `.workbuddy/coop/BATON.md` 末尾追加一条（格式见该文件顶部）。
   要写清：分支、做了什么、未完成的部分、已知风险、接手方第一步该做什么。

交完后提示用户："请把另一个 AI 的《接手提示词》贴过去。"

### 0.3 分工原则

| 角色 | 擅长 | 适合的活 |
|---|---|---|
| **Claude** | 理解需求、方案设计、架构判断、代码审查 | 拆解任务、定方案、挑毛病、质疑设计决策 |
| **Codex** | 严格执行既定方案、写代码、跑验证 | 按 spec 落地、修 bug、写回归脚本、跑 tsc/build/smoke |

- **方案设计、架构取舍、代码审查 → 优先 Claude**（有主见，能发现 Codex 想不到的问题）。
- **按既定方案写代码、跑验证、修明确 bug → 优先 Codex**（听话，约束清晰时表现稳定）。
- **小改动（改字段、修一个明确 bug）不必换班**——换班成本高于收益，谁在轮值谁做。

### 0.4 交接时必须写清的东西（因为接手方看不到你的对话）

接手方**没有任何上下文**。所以交接记录里必须包含：

- 当前在哪个**分支**、有没有**未提交**的改动、有没有**未推送**的提交；
- 这次改动的**文件清单**与各自作用；
- **验证状态**：跑了什么命令、真实结果是什么、**哪些没验证**；
- 有没有**待用户在 Supabase 控制台执行的 SQL**（这类步骤 AI 做不了，必须明确列出来）。

### 0.5 每次汇报必须告诉用户"下一步找谁"（强制）

> 用户不想自己看 `state.json` 判断该找谁。**每个 AI 在每次汇报的末尾，必须明确给出下一步该找哪个 AI。**
> 这是硬性要求，不是可选建议。

**汇报风格（2026-09-29 用户明确拍板，务必遵守）**：用户是非专业开发者，看不懂术语。
他明确说喜欢"结论先行 + 分步骤 + 说清下一步"这种方式，希望长期保持。所以汇报时：

1. **第一句就是结论**，用普通话把结果说清，不用"让我看看""我来分析"开头。
2. **术语当场解释**——假设对方是文科大学生第一次听。宁可换大白话。
3. **给可直接复制粘贴的完整内容**，不要让他自己填参数。
4. **每步标明会不会影响线上**（他最怕"手一抖网站崩了"）。
5. **先给推荐，再给 1–2 个备选**；不要平铺一堆选项让他自己掂量。
6. **末尾必须给「下一步」区块**。

同类要求已写入两边全局规则（`~/.claude/CLAUDE.md`、`~/.codex/AGENTS.md`）的「汇报风格」一节，
所有项目通用，本项目同样适用。

**第 5 条禁止事项是"不要擅自 push"，不是"不要提下一步"——汇报时漏掉指路 = 没完成这一轮。**

汇报末尾**必须**包含下面这个区块（照抄格式，把 `<>` 内容换成实际情况）：

```
—— 下一步 ——
现在轮到：<Claude / Codex / 你自己决定>
原因：<一句话，比如"代码写完了，需要一个没参与写的人来挑毛病">
你查收无误后：把《接手提示词》里的 <Claude段 / Codex段 / 收尾段> 贴给 <Claude / Codex>
```

如果**还没到换班**（活没干完、或等你决策），就写：

```
—— 下一步 ——
现在轮到：Codex（还是我，活没干完）
你需要做的：<具体一件事，比如"打开线上地址点一遍，确认会员页面能开">
```

### 0.6 怎么判断下一步该找谁（路由规则）
按**刚做完的活是什么类型**判断，不要凭感觉：

| 刚做完的活 | 下一步找谁 | 为什么 |
|---|---|---|
| 写好了代码 / 修好了 bug / 跑完了测试 | **Claude 复核** | 需要一双没参与写的眼睛，Claude 擅长挑毛病 |
| 出了方案 / 做了架构判断 | **Codex 执行** | Codex 按方案写代码最稳 |
| 方案被 Claude 挑出问题 | **Codex 修** | 修改实施归 Codex |
| 方案 + 执行都完成了，等发布 | **不用换**，让用户决定 push | 发布决策是用户的事 |
| 小改动（改字段、修一个明确 bug） | **不用换** | 换班成本高于收益 |
| 卡住了、反复试都不成 | **换另一个试** | 换个思路常能破局 |

**例外**：`state.json` 里 `blocked: true` 时，无论上表怎么判，都先写"**卡住了，需要你先处理**"并说明卡在哪。

**写完后回填 `state.json`**：把 `nextAI`（下一个该接手的 AI）和 `nextAIReason`（一句话原因）写上，
让下一个读它的 AI 也能确认自己没接错人。汇报里的「下一步」区块必须和 `nextAI` 一致——
两者对不上，说明你自己也没想清楚，回去想清楚再汇报。

### 0.7 禁止事项

1. 不要在 `holder` 不是自己时改代码。
2. 不要绕过轮值锁并行开发（"我就改一行"也不行——另一个 AI 看到的是冲突）。
3. 不要替另一个 AI 猜它的进度；以 `state.json` 和 `BATON.md` 为准。
4. 不要擅自 `git push`（见 §8.1：推送前必须先问用户）。
5. 不要在交接记录里写"应该没问题"这类无证据结论。
6. **不要在汇报末尾漏掉「下一步」区块**（见 §0.5）。用户靠它决定去找谁，漏了就等于让用户自己猜。

---

## 1. 项目定位（决定所有取舍）

- 「简味点单」是一款**顾客端 + 商家端 + 骑手端**三端联动的外卖 App，对标美团 / 饿了么，包含丰富但克制的动画。
- 性质：**大学课程 / 个人作品集项目**，不商业化运营。优先级：零成本 > 可演示 > 功能完整。
- **不接真实支付、不接真实短信、不上架应用商店**——这些功能用 Mock 实现，并在代码与文档中注明"已预留真实接入点"。
- 阶段路线（2026-09-27 更新）：
  1. 前端高保真原型（**已完成**，原型版本 v60）；
   2. 接入真实后端数据库（**✅ 第 2 期已全部完成（2026-09-27）**：账号/店铺/菜品/订单/聊天/地址/评价/售后/异常/优惠券/钱包全部上云）；
  3. 部署到 Cloudflare Pages 上线演示（**已完成**：https://jianwei-57i.pages.dev/ ）；
  4. 实时推送（第 3 期，**✅ 已上线（第八版起）**：数据库里改一行，其他端不刷新就能看到；
     conversations 与商家配置表的 Realtime SQL 已执行，见第 6 节）；
  5. 续做（第 2 期含 2h 已于 2026-09-27 全部完成，含商家侧配置类写操作上云）：
     通知中心跨设备（notifications 表订阅）、骑手位置实时、第 4 期图片上云（Storage，可选）、作品集材料（可选）。
- **给人看的交接摘要见 `docs/交接说明.md`**（含演示账号、演示脚本、线上资产清单、已知的坑）。
- 原生套壳 App（Android/iOS 安装包）不是目标，产品形态是**移动端竖屏网页应用**。

### 1.1 当前进度快照（2026-09-29，动手前先看这里）

| 项 | 现状 |
|---|---|
| 线上站点 | **第十五版**（钱包断网恢复、同编号防重复记账、余额支付原子事务已发布） |
| Git 基线 | 生产 `main` / `origin/main` 为 `040eb77`；当前检出 `codex/membership-pending-sql`，会员准备提交 `30f6d03` 与交接 `6fcb62d` 已 Push 到同名远程分支；第十六版本地改动尚未提交 |
| 关键提交 | `ab9e581` 钱包断网一致性与重复记账；`a684850` 余额支付弹层与优惠券钱包回归；`da6c3df` 规格/加料与分类管理上云；`e363ffc` 支付/抢单提示误报 + 到店自取；`3aac1d2` 骑手链路落库 |
| 已在真机验证 | `npm run smoke`（真浏览器三端 18 页巡检）+ 7 个针对性回归脚本：商家端商品管理、商家拒单、购物车加减号、顾客被拒单提醒、骑手主链路（抢单→取餐→配送→送达）、支付、到店自取；另有 `verify-realtime.mjs`（跨端推送）、`verify-merchant-config.mjs`（商家写库 + 越权对照）与 `npm run verify:membership`（会员开通 5 环节，第十六版） |
| 第十三版验证 | `tsc`、`eslint`、`build:standalone`、三端 `npm run smoke` 和离线 SQL 校验通过；SQL Editor 返回 `Success. No rows returned`；线上首页 HTTP 200 且脚本含新功能标记；用户反馈跨设备“同步”。新功能没有单独的自动化浏览器端到端脚本 |
| 本轮钱包验证 | `npm run verify:wallet-network`：断网失败、恢复重试、充值/余额支付响应丢失的真实浏览器与数据库对照通过；原有 `verify:coupon-wallet` 也通过 |
| 尚未验证 | 提现、两台设备完整走单的画面观感尚未单独记录 |
| 待人工操作 | 无待执行 SQL；会员迁移已执行，第十六版本地自动回归、三端冒烟和用户亲手验收均通过，当前等待提交 / Push 决策；线上仍为第十五版 |

> 开工前若发现本地还有**未 push 的提交**，先跟用户确认要不要推，不要把半成品直接推上线。

## 2. 技术栈

- 前端：React 19 + TypeScript + Vite 8（SPA）
- 样式：Tailwind CSS v4（主题变量在 `src/tailwind-theme.css`）
- UI 组件：shadcn/ui（基于 Radix UI，组件在 `src/components/ui/`）
- 路由：react-router-dom
- 动画：framer-motion（另有 @formkit/auto-animate、GSAP）
- 图表：echarts-for-react
- 图标：lucide-react
- 后端：Supabase（托管 PostgreSQL + Auth + PostgREST + Realtime 已接入；Storage 图片上传待做）
- 包管理：npm（仓库含 package-lock.json）

## 3. 本地运行与构建（重要：不要用平台包装脚本）

仓库里的 `scripts/dev.mjs`、`scripts/build.sh`、`.spark/`、`shared/` 是原托管平台（妙搭）的包装文件，会注入 `/app/<平台应用id>` 路径前缀和 CDN 变量，**在平台外不要使用**。请直接用 Vite 原生命令：

```bash
npm install
npx vite                 # 本地开发，默认 http://localhost:5173
npx tsc -p tsconfig.app.json   # 类型检查（必须 0 错误）
npm run build:standalone # ✅ 对外部署用这个：产物在 dist/client
npx vite build           # ⚠️ 平台托管构建，产物同样在 dist/client，
                         #    但含 {{appName}} 占位符/外链统计脚本/妙搭水印，**不可对外部署**
```

> 构建产物目录是 **`dist/client`**（不是 `dist/`），Cloudflare Pages 的"输出目录"填这个。

已知平台耦合点（迁移期需要处理）：

1. 约 30 个 `src/` 文件引用了 `@lark-apaas/client-toolkit-lite`（平台 SDK，公开 npm 包，npm install 能拉取），但它在平台外运行时可能依赖平台环境。需要实际运行验证，必要时写一个轻量兼容层（stub）替代，**不要让整个应用依赖平台上下文才能启动**。
   **已验证结论（2026-09-27）**：**不需要写 stub**。`scopedStorage` 只是给 localStorage 加 `__miaoda_<appId>__:` 前缀，取不到 appId 时退化为 `__miaoda___global__:`，功能正常（副作用：换环境后旧的本地数据不会自动迁移）；`logger` 是 console 包装。真正需要处理的是平台注入物（HTML 占位符、外链统计脚本、妙搭水印），已由 standalone 构建模式解决，见第 5 期。
2. 数据层当前通过平台的 scopedStorage 访问浏览器 localStorage（key 前缀形如 `__miaoda_<appId>__:`）。接入 Supabase 后将逐步替换。
3. ~~`index.html` 是源码模板，标题还是占位"应用标题"，并引用了平台域名的 favicon~~ ✅ **已清理（2026-09-27）**：标题与描述改为「饭否外卖」、`lang="zh-CN"`、favicon 用本地 `/favicon.svg` 并删除平台外链、补暖橙 `theme-color`。

## 4. 当前架构（v60，必须理解后再改）

### 4.1 三端严格独立（最高优先级硬约束）

- 启动选择器（Launcher）三卡片：顾客端 / 商家端 / 骑手端。
- 三端有**各自独立的账号池**，绝不允许串号、串端。
- 路由分目录：`/customer/*`、`/merchant/*`、`/rider/*`（注意骑手目录拼写就是 `rider`）。
- 端内**没有跨端跳转/返回**；要切换端只能回到启动选择器。
- 业务数据（订单、消息）在三端之间共享联动（当前靠本地存储模拟，接入 Supabase 后靠数据库 + Realtime）。

### 4.2 账号与店铺

- 登录方式：验证码（演示码固定 `123456`）、密码、注册、找回密码、协议勾选；一键体验是次要入口；登录态持久化。
- **一账号一店铺**（硬约束）：新商家注册 → 两步建店向导 → 进入自己店铺的控制台；不存在"一个账号开多家店"的入口。`getAllShops()` 会动态合并演示店铺与自建店铺。

### 4.3 订单状态机（9 态，枚举值不可随意改）

```
pending_payment  待支付（提交订单后、支付前）
pending          待商家接单
preparing        商家已接单，备餐中
ready            已出餐，待骑手取餐
picked           骑手已取餐
delivering       配送中
delivered        已送达（终态，可评价）
cancelled        已取消（终态）
rejected         商家拒单（终态）
```

- 超时规则（常量集中在 `src/hooks/useOrders.ts`，勿散写魔法数字）：
  - 待支付：`PAY_TIMEOUT_MS` = 15 分钟，超时**自动取消**（`cleanupExpiredPending`），取消原因"支付超时自动取消"。
  - 商家接单：`MERCHANT_ACCEPT_TIMEOUT_MS` = 8 分钟。超时**不自动拒单**，订单保持 `pending` 并打上 `acceptExpired` 标记（`cleanupExpiredPendingAccept`）：商家端显示"已超时"标签，顾客端显示**黄色**提示条"商家暂未接单，您可催单或取消订单"。
  - 8 分钟是演示保险值（2026-09-27 由 3 分钟放宽）：现场演示要切端、讲解，3 分钟容易在讲别的功能时误触发提示条。要专门演示"超时提醒"时，把该常量临时改成 `20 * 1000`。
  - 两个清理函数只在进入订单列表 / 收银台页时各执行一次，**不是定时轮询**。
- 标准链路：提交订单（pending_payment）→ 收银台支付成功 → 进入进行中（pending）→ 商家接单/拒单 → 出餐 → 骑手抢单 → 取餐 → 配送 → 送达 → 评价。
- 订单数据有 `normalizeOrder` 归一化（对 address/items/金额/时间/statusTimeline 等字段兜底），脏数据不允许炸页面。新增字段访问时保持防御式写法。

### 4.4 消息 / 通知系统

- 三端统一用 role 驱动的 `MessageCenterPage`（消息列表）、`ChatPage`（聊天页）、`NotificationCenterPage`（通知中心），不要为某一端另写一套。
- 会话 id 前缀：`shop:`（顾客↔商家）、`om:`（订单消息）、`or:`、`rm:`（骑手相关）。旧本地数据加载时幂等合并，避免重复会话。
- 未读数有三个方向字段：`unreadCustomer` / `unreadMerchant` / `unreadRider`，按会话参与方分别计数。
- 通知按角色（顾客/商家/骑手）分别投递，不允许三端共用一份写死的通知导致串口吻。
- 消息更新监听：**保留**原来的 CustomEvent + storage 双监听，在其上叠加第 3 期的 Realtime 订阅
  （`src/data/realtime.ts`：收到推送 → 调用各模块自己的「从数据库重拉」 → 再派发原来的 CustomEvent）。
  这样页面与业务逻辑一行都不用改；未配置 Supabase / 未登录 / 断网时订阅是空操作，
  自动退回原来的「手动刷新才看得到」，不会白屏。
- **2h 起店铺配置也走同一套**：`useShops` 注册 `shops` 类别 → `reloadShops()` 重拉店铺/分类/菜品/活动，
  所以商家在商家端上下架、改价、改活动之后，顾客端**不刷新**就能看到（前提是那张 SQL 已执行）。
- **IM 排版硬约束**：本人消息整行靠右、本人头像最右贴边、气泡在头像左侧；对方头像最左、消息靠左。**没有自动回复功能（曾被删除，禁止恢复）**。
- 聊天页订单条/店铺条、快捷短语只在有数据时渲染。

### 4.5 数据、图片、动画、错误兜底现状

- 数据：主要业务数据已接 Supabase；本机覆盖与少数 Mock 状态仍用 localStorage（通过平台 scopedStorage 封装）。演示数据由真实操作驱动，**禁止写死演示订单/会话**。
- 图片：11 张真实菜品/Banner 图在 `public/images/`，图片加载失败时用暖橙底色 + 店铺/菜品首字占位（onError），杜绝裂图。真实照片必须保持自然彩色，**不得加滤镜/着色**。
- 动画规范（v60 已落地，改动时遵守）：
  - Tab / 分类 / 步骤切换：**即时呈现**，不使用 AnimatePresence 的 wait/popLayout 整页进出场（历史上这是白屏和抽搐的根源）。
  - 弹层 / Sheet / Modal：200–250ms 进出场。
  - 列表首次入场：只在首次挂载时一次性播放，数据刷新/重渲染**不得重播**；不要用会反复触发的 stagger。
  - 只允许对 `transform` 和 `opacity` 做动画，禁止动画 height/width/top/left/margin 等引起重排的属性。
  - 循环动画（红点脉冲等）用纯 CSS（animate-pulse / animate-ping），不要用 JS 动画库无限循环。
  - 尊重 `prefers-reduced-motion`。
- 错误兜底：`app.tsx` 最外层有全局 ErrorBoundary；消息/通知等页面有独立 ErrorBoundary；三端页面 Outlet 有 PageErrorBoundary。兜底组件必须能自己撑起高度（不能依赖 h-full 父容器），任何页面崩溃显示"页面加载失败，点击重试"，按钮真实可用。
- 布局：三端 Layout 用 `h-screen min-h-[640px]` + 显式 flex-basis，避免移动 webview 下高度塌缩白屏。
- 导航：真实 browser history；Tab 切换用 replace；页面返回用 history.back()；不允许出现 404——任何 navigate 必须带 `/customer`、`/merchant`、`/rider` 前缀且路由已注册。

## 5. 不可违背的硬性约束清单（改每条代码前对照）

1. 三端严格独立，绝不串号 / 串端；端内不跨端跳转。
2. 一账号一店铺，不得做成一账号多店。
3. 暖橙外卖品牌色三端统一；真实照片自然彩色不着色；动画细腻克制；移动端竖屏。
4. 不允许空壳 / 僵尸按钮（每个按钮都要有真实 handler、跳转或占位反馈）；不允许 404。
5. 订单角标只统计"进行中 / 待处理"，"全部""已完成" Tab 永远不显示角标。
6. IM 排版规则见 4.4；自动回复禁止恢复。
7. Toast：无关闭叉号，约 2 秒自动淡出，不遮挡主要操作区（底部呈现）。
8. 数据由真实下单 / 操作驱动，禁止写死演示订单、会话；删过的内置演示订单不得加回。
9. 界面语言：简体中文。
10. 每次完成一个阶段：类型检查 0 错误、构建通过，并 git commit 留存。

## 6. 后端迁移与部署进展（业务数据、实时推送及第十三版商家配置已上线；第 4 期 Storage 可选）

### 已提供的后端资产（在 `supabase/` 与 `docs/`）

- `supabase/migrations/20260915000000_init_schema.sql`：初始化库结构——24 张表、16 个枚举、56 条 RLS 策略、3 个 RPC（`apply_wallet_txn`、`claim_order`、`reply_review`）、3 个 Storage 桶（avatars、dish-images、review-images）；含 `handle_new_user` 触发器（从注册元数据 role 自动建 profile）；Realtime publication 覆盖 orders/order_items/messages/notifications/refund_requests/delivery_exceptions。
- `supabase/migrations/20260915010000_seed_demo.sql`：演示数据——9 家店、26 个分类、62 道菜、6 张券、3 个演示账号。演示账号（密码均为 `123456`）：
  - 演示顾客 `13800000001` ／ 演示商家 `13800000002` ／ 演示骑手 `13800000003`
  - **登录填手机号**，前端映射为 `phone{手机号}@jianwei.app` 调 Supabase Auth（见下一条「登录标识」）。
  - ⚠️ **合成邮箱必须带字母前缀**：Supabase Auth 会拒绝「本地部分纯数字」的邮箱——
    实测 `13900000099@jianwei.app` 直接返回 `email_address_invalid`，登录路径甚至报 500。
    所以统一用 `phone{手机号}@jianwei.app`，不要写成 `{手机号}@jianwei.app`。
  - 跑完后的自检期望：shops=9、categories=26、dishes=62、coupons=6、auth.users=3。
  - 图片存站点根相对路径 `/images/xxx.jpg`（前端 `public/images/` 下 11 张真实图片），不依赖原托管平台。
- `supabase/gen/gen_seed.py`：seed 生成器（改演示数据后 `python3 supabase/gen/gen_seed.py > supabase/migrations/20260915010000_seed_demo.sql`）。
- `supabase/migrations/20260927000000_realtime_conversations.sql` 与
  `20260927010000_realtime_shop_config.sql`：把 `conversations` 与商家侧配置表
  （shops/categories/dishes/shop_activities/规格加料）补进 `supabase_realtime` publication；
  **后者已经把前者包含在内，只需要跑后者**（两份都可重复执行）。
- `supabase/migrations/20260928000000_fix_order_items_dedupe.sql`：**一次性数据清理**——删掉 2026-09-28 那个
  bug 写重复的 `order_items` 行（每笔订单的每个菜品组合只保留一行），并加 `(order_id, sort)` 唯一索引防止再犯。
  必须在 **Supabase 控制台 → SQL Editor** 执行：应用侧刻意没有 `order_items` 的删除权限（明细是快照）。
  可重复执行；跑完的自检应当每笔订单「明细合计 = 商品小计」。
- `docs/Supabase控制台操作清单.md`：在 Supabase 控制台的逐步操作手册。
- `docs/简味点单-Supabase数据库设计稿.html`：数据库设计可视化（ER 图、枚举、RLS 说明），浏览器直接打开。

### 迁移分期（建议严格按期推进，每期都要 tsc 0 + build 过 + git commit）

- **第 0 期（人工，在 Supabase 控制台）**：注册 Supabase → 新建项目，**区域选 Singapore（新加坡）或 Tokyo（东京），区域创建后不可更改** → SQL Editor 依次跑 init、seed 两个 migration → Auth 设置里关闭 "Confirm email"（否则演示账号无法直接登录）→ 拿到 Project URL 和 anon public key（注意：anon key 设计上就是公开的，安全完全靠 RLS；**service_role key 严禁放进前端**）。
- **第 1 期（Auth）**：✅ **已完成（2026-09-27）**
  - 新增 `src/lib/supabase.ts`：创建 client、读取环境变量、提供手机号↔合成邮箱映射；
    **两个环境变量缺失时 `supabase` 为 null，`useAuth` 自动退回原来的本地模拟登录**，站点不会白屏。
  - `useAuth` 的五个方法（验证码登录 / 密码登录 / 注册 / 重置密码 / 一键体验）改为**异步**并接上真实认证；
    每次登录都会校验账号角色与当前端是否一致，不一致立即 `signOut`（三端独立硬约束）。
  - 登录成功后从 `profiles` 读昵称/头像/工号，商家再读自己的 `shops` 行（一账号一店铺）；
    刷新页面通过 `getSession()` 恢复登录态；`logout` 同时清理 Supabase 会话。
  - 「一键体验」= 用该端演示账号（13800000001/2/3，密码 123456）真实登录；
    「验证码登录」的前端 Mock 保留，通过后用演示密码换取真实会话，因此只对演示账号有效（界面已提示）。
  - 「重置密码」受限于 Supabase 需先有会话：只允许当前登录账号改自己的密码（界面已注明无真实短信通道）。
  - `updateProfile` 会把昵称与头像同步到 `profiles` 表（头像暂存 base64，第 4 期迁到 Storage）。
  - 登录页的五个调用点已改为 `await` 并加 `try/finally`，避免请求期间重复提交。
  - **线上必须先配环境变量**：Cloudflare Pages → Settings → Environment variables 添加
    `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`（publishable/anon，**不要填 secret/service_role**），
    首页右上角 Environment variables 面板加入后需要重新部署一次才生效。未配置时线上会以本地模拟登录运行。
  - **登录标识（2026-09-27 用户拍板，方案 A）**：登录页**保持手机号**不变（现为 11 位正则校验，验证码/密码/注册/找回四条路都基于手机号），
    程序内部把手机号映射成合成邮箱 `phone{手机号}@jianwei.app` 去调 Supabase Auth，用户无感知。
    Supabase Auth 需要真实邮箱，但**不发任何邮件**（演示环境已关闭 Confirm email）。
  - 短信验证码继续由前端 Mock（固定 `123456`），代码中注明真实短信接入点。
- **第 2 期（业务数据）**：把 shops / shop_settings / categories / dishes / orders / order_items / addresses / messages / reviews / coupons / 会员钱包 / notifications 从 localStorage 逐步改为 Supabase 查询。**开工前先以当前前端源码为准做一次字段对账**：前端数据模型（见第 4 节，尤其 9 态订单枚举、会话 id 模型、未读三字段）与 SQL 表结构有差异时，新增 ALTER migration 补齐，不要推翻已有 24 张表。
  - 字段对账已完成（见 `docs/后端重写-对账与设计.md`），缺口已由重写后的 migration 补齐。
  - ✅ **2a 读取路径已完成（2026-09-27）**：店铺 / 分类 / 菜品 / 规格 / 加料 / 营销活动改从数据库读取。
    实现方式：新增 `src/data/shops-remote.ts`（一次性并发取回并组装成前端 `IShop` 结构）
    与 `src/hooks/useShops.ts`（登录后触发加载、订阅变更事件重渲染）；
    `getAllShops()` **保持同步签名**，内部改为「数据库缓存 → 内置演示数据」兜底，
    因此调用页面只需加一行 `useShops()` 订阅，不必改成异步加载态。
    `logout()` 会清空店铺缓存，避免跨账号残留。
  - ✅ **2b 订单读写已完成（2026-09-27）**：下单写库、订单状态流转写库、跨端可见。
    实现方式：新增 `src/data/orders-remote.ts`（行↔模型映射 + 读取 + upsert），
    在 `useOrders` 里加「登录后拉取 + state 变化后回写」的镜像层——
    **19 处既有业务逻辑（状态机、时间线、金额）一行未改**。
    - **订单 id 改为 uuid**（数据库主键是 uuid，原来的 `ORD+时间戳` 写不进去）；
      界面"订单号"改用 `formatOrderNo()` 展示数据库自增列 `order_seq`（如 ORD000001）。
    - 接口实测：顾客下单→商家可见→顾客支付→商家接单→商家出餐→顾客看到 ready，全链路通过；
      数据库 `guard_order_transition` 正确拒绝非法跳转（如 pending_payment → preparing）。
    - ✅ 跨设备"实时"推送已完成（第 3 期，见下）；
      售后退款、配送异常、评价的写库（它们嵌在订单对象里，尚未单独写表）；
      商家侧配置类写操作（上下架、营销活动）仍在 localStorage（2c）。
    - ⚠️ **演示脚本注意**：顾客必须从**演示小店**下单，商家端才能看到——
      因为演示商家账号拥有的是"演示小店"，而其他 8 家是所有人只读的内置店。
  - 🔧 **2026-09-28 修复（浏览器端到端首次验收发现的 bug，提交 `c7c24d3`）**：
    - **订单明细被重复写入**：`upsertOrder` 每次回写都把明细整个再插一遍（注释写了"已存在则跳过"、代码没跳过），
      而 `order_items` 是不可改的下单快照（RLS 只有 select / insert）且没有唯一约束——实测一笔订单被写成
      **96 条**、另一笔 **192 条**，顾客端与商家端就显示成一长串同样的菜。现在**只在新订单时写明细**，
      老订单仅在"库里确实一条明细都没有"时补写。
    - **商家端「商品管理」永远停在"店铺数据加载中..."**：只有顾客端页面调用的 `useShops()` 会触发
      `ensureShopsLoaded()`，商家端页面一律只调 `getAllShops()` + `useShopStatus()`，没人触发加载
      → `getAllShops()` 回退到内置演示店铺（id `'1'`~`'8'`）→ 商家自己的 uuid 店铺找不到。
      现在 `useShopStatus` 登录后触发一次（幂等，覆盖所有商家端页面），该页也加了明确的失败提示。
    - 遗留数据清理：`20260928000000_fix_order_items_dedupe.sql`（**需在 Supabase 控制台执行一次**，
      应用侧没有 order_items 的删除权限）。用户已于 2026-09-28 确认要清理；
      清理前实测 295 行 → 6 行（删 289 行多余数据），每笔订单金额仍与商品小计一致。
      脚本还会加 `(order_id, sort)` 唯一索引，若以后代码又写重了会直接撞冲突而不是静默堆积。    - **商家拒单不生效（2026-09-28 二次修复，用户反馈）**：两个叠加的根因——
      ① `upsertOrder` 用「先 INSERT 遇 23505 再 UPDATE」，但 `orders` 的 insert 策略只放行顾客，
      商家插入先撞 **RLS 42501**（实测：商家 42501、顾客 23505），UPDATE 永远执行不到 →
      商家接单/拒单/出餐全都写不进数据库。改成「先按主键 UPDATE，0 行再 INSERT」
      （新增 `upsertByKey()`；`refund_requests`、`delivery_exceptions` 同样受益——店主的售后处理、
      异常处理以前也写不进去）。
      ② `normalizeOrder` 的状态白名单**漏了 `rejected`**（也漏了 `pending_payment`），归一化会把
      rejected 悄悄改回 pending → "订单还在、仍显示待接单、顾客端什么也看不到"，
      而库里留下一条带 `reject_reason` 却还是 pending 的畸形单。白名单已抽成 `ALL_ORDER_STATUSES`（9 态）
      并补全，未知状态会打日志而不是静默改写。
    - 回归脚本 `scripts/e2e-reject.html`：无头浏览器真实跑「商家拒单 → 顾客端历史订单出现已拒单」。
    - **购物车减号不生效（2026-09-28 修复）**：`ShopDetailPage` 的 `handleDecrease` 把 `dishId` 当成
      购物车的 key 传给了 `decreaseItem()`，而购物车是按 `skuKey`（菜品 + 规格 + 加料，形如 `<uuid>____`）存的
      → 永远匹配不到，点减号数量不变。现在先按 `dishId` 找到购物车里对应的明细、再按 `skuKey` 减
      （回归脚本 `scripts/e2e-cart.html`）。

    - **骑手链路写不进数据库（2026-09-28 修复）**：`orders.rider_id` 是 uuid 列（指向 `profiles.id`），
      而骑手端页面把**工号**（`R0003`）当骑手身份传给了 `riderClaim`，写库直接被拒 →
      抢单在本机看着成功、下一秒被「以数据库为准」的刷新打回「待抢单」（与商家拒单同一类问题）。
      现在订单里的骑手身份统一用 `user.id`（uuid），工号只用于展示；`ChatPage` 的骑手身份也一并对齐。
      回归脚本 `scripts/e2e-rider.html`：无头浏览器真实跑「抢单 → 确认取餐 → 开始配送 → 确认送达」。
    - **「函数返回 null」类误报（2026-09-28 修复）**：React 的 setState 更新器是延后执行的，而 `useOrders` 里 20 来处把结果写进更新器再 return，调用方拿到 null 就以为失败——于是「支付成功却弹支付失败（还不跳成功页）」「抢到了却提示已被抢走」。现在 `setOrders` 已包成同步执行更新器的版本（配 `ordersRef`），新增函数照旧写即可，不要为此去改各个函数体。
    - **到店自取（2026-09-28）**：`orders.is_pickup` 标记自取单——不进骑手抢单大厅、出餐后商家点「顾客已取餐」直接完成（状态机允许自取单 ready → delivered）。需先跑迁移 `supabase/migrations/20260928010000_orders_pickup.sql`；未跑时写库会自动剔掉该字段降级，不会整单写不进去。
    - **顾客被拒单提醒（2026-09-28 新增，第十二版）**：顾客端每次重拉订单时对照「本机上次见到的状态」，
      一旦变成 `rejected` 就往通知中心写一条（「订单被商家拒单」+ 原因）并弹一个 toast。
      只有顾客端读写这个「见过状态」，避免商家端在同一浏览器里操作时吃掉顾客还没看到的变化
      （回归脚本 `scripts/e2e-reject-notify.html`）。
    - **拒单后商家端"看不到"（2026-09-28 三次修复）**：`MerchantOrdersPage` 的「已完成」标签只匹配
      `delivered`，于是订单一旦被拒/被取消就从**所有标签**里消失（既不在待接单、也不在已完成），
      用户看到的现象是"拒单后订单没有消失也没有显示拒单"。现已把 `rejected` / `cancelled` 归入「已完成」，
      并在卡片上显示「已拒单 · 原因」「已取消 · 原因」。
  - ✅ **2c 消息与会话已完成（2026-09-27）**：顾客↔商家跨设备聊天成立。
    新增 `src/data/messages-remote.ts` + `useMessages` 里的镜像层（思路同店铺/订单）。
    会话 id 直接沿用前端语义前缀（`shop:` / `om:` / `or:` / `rm:`）作为数据库主键，前后端无需再映射。
    - **踩坑记录**：`supabase.from(x).upsert()` 走的是 `INSERT ... ON CONFLICT DO UPDATE`，
      冲突分支会改用**更新**策略判定，实测在 RLS 下会被拒（同样的数据用普通 INSERT 却能通过）。
      现已统一改为「**先 INSERT，遇 23505 再 UPDATE**」，会话/消息/订单三处一致。
      ⚠️ 后续新增写库逻辑请沿用这个写法，不要用 `.upsert()`。
    - 消息 id 也改为 uuid（数据库 `messages.id` 是 uuid）。
    - ⚠️ **限制**：内置演示店（owner_id 为空）没有对应商家账号，这类咨询会话无法入库，保持纯本地；
      跨设备聊天只对「店铺有真实归属」的会话生效（当前即演示商家自己的「演示小店」）。
  - ✅ **2d 地址上云已完成（2026-09-27）**：新增 `src/data/addresses-remote.ts`，`useAddresses` 对外接口不变（CheckoutPage / ProfilePage 零改动）。
    - 字段对账：前端 `IAddress` 与 `addresses` 表一一对应（`address_tag` 枚举值 `home/company/school/none` 两边一致），无需补 ALTER。
    - 登录后从数据库拉一遍（RLS `addresses_owner` 限定本人），增删改按行直接写库；
      未配置 / 未登录 / 读写失败时静默退回原 localStorage + `MOCK_ADDRESSES` 行为。
    - ⚠️ 数据库有「每账号至多一个默认地址」的部分唯一索引 `addresses_one_default`：**设默认必须先清旧默认再写新默认**，顺序不能反。
    - ⚠️ 登录后地址列表为空是**正常初始状态**（seed 不预置地址，由用户真实添加，跨设备可见）；`MOCK_ADDRESSES` 只在未登录 / 无数据库时兜底展示，不写库。
    - 地址只在顾客端用、无跨端联动需求，**不进 Realtime publication**。
  - ✅ **2e 评价/售后/异常上云已完成（2026-09-27）**：新增 `src/data/reviews-remote.ts`。
    - 评价：登录可读（店铺页/商家端共用一个评价池），顾客提交走 INSERT（RLS 校验本人+顾客角色），
      商家回复走现成 RPC `reply_review`（reviews 表刻意没有 UPDATE 策略，RPC 内校验店主）。
      ReviewPage 提交时改用真实登录 id（原写死 `user1` 入不了库）；评价 id 改 uuid。
    - 售后退款/配送异常**随订单镜像单独写表**：`refund_requests`（order_id 唯一，先插冲突再改——
      商家同意/拒绝的更新走这条路径）、`delivery_exceptions`；`RF/EX` 前缀 id 改为 uuid。
    - `IRefundRequest` 新增 `handledById` 映射数据库 `handled_by`（uuid 列），不要把 uuid 当昵称展示。
    - ⚠️ 旧本地数据（`R/ORD` 前缀订单、`'1'~'8'` 店铺、`RF/EX/R` 前缀记录）保持纯本地不入库；
      演示流程里真实订单产生的评价/售后/异常都跨设备可见。
  - ✅ **2f 优惠券上云已完成（2026-09-27）**：新增 `src/data/coupons-remote.ts`。
    - 前端扁平 `ICoupon` = 数据库 `coupons`（模板，seed 预置 6 张）+ `user_coupons`（领取记录，
      unique(user_id, coupon_id)）拼合；登录后以数据库为准。
    - 领券先 INSERT、23505 视为幂等成功；核销（支付成功时）更新领取记录 status/used_at；
      `expired` 不入库，读取时按 expire_date 现算；券模板由运营在控制台维护，无前端写入口。
    - MOCK 券（`c1`~`c6` 非 uuid）仅未登录兜底，领取/核销只走本地。
  - ✅ **2g 钱包/会员/提现上云已完成（2026-09-27）**：新增 `src/data/wallet-remote.ts`。
    - 余额以 `profiles.balance` 为准：充值/消费/退款/提现扣减一律走现成 RPC `apply_wallet_txn`
      （SECURITY DEFINER 内改余额+写流水原子完成，余额不足服务端抛错），成功后用返回流水
      替换本地临时记录（拿到 uuid 与权威 balance_after）。
    - 提现记录写 `withdraw_records`（uuid 数据库生成；演示 3 秒到账同时更新本地与库）；
      成长值/累计消费同步 `profiles.growth_points/total_spent`；会员等级不入库、按成长值现算。
    - ⚠️ 登录后钱包余额 0、流水/提现记录为空是**正常初始状态**（seed 不预置余额，充值即真实入库）；
      支付密码继续本地 Mock（`profiles.pay_password` 保留默认值不参与校验）；`point_records` 暂不写（无积分明细展示）。
  - ✅ **2h 商家侧配置写操作上云已完成（2026-09-27，第十一版）**：新增 `src/data/shop-config-remote.ts`，
    把商家端的「上下架 / 售罄 / 价格 / 库存 / 名称描述 / 店铺公告·营业时间·起送价·配送费·营业开关 /
    营销活动增删改启停（含满减老接口）/ 新增菜品」全部改成「本地先行 + 尽力写数据库」。
    - 核心取舍：**写库成功后把字段交还给数据库**（清掉本地覆盖），否则本机覆盖会永远盖住别处的改动；
      写库失败/未登录/内置演示数据时静默退回纯本机，行为与改造前一致。
    - 读路径改为「本机覆盖 ?? 数据库基础值」：菜品上下架/售罄/库存、店铺营业开关与公告因此能跨设备生效
      （`ShopDetailPage` 顾客端、`MerchantDishesPage` 商家端都已按数据库值显示）。
    - `useShopStatus` 不再为**每一道菜**预置默认覆盖（老做法会把 `onShelf:true` 写进本机、永久盖住数据库），
      并在店铺数据到达后做一次老数据清理与店铺级字段对齐（`pruneSeededDishOverrides` / `reconcileShopFields`）。
    - 自检脚本 `scripts/verify-merchant-config.mjs`：真连数据库验证三类写操作 + 越权对照 + 跨账号可见性（改完自动还原）。
  - ✅ **第十三版已上线（2026-09-29）**：规格/加料一次性写库并支持清空；自定义分类新增、重命名、删除写库，跨设备读取。迁移 `20260929000000_shop_options_categories.sql` 已执行，用户反馈同步正常。旧本机分类不会自动迁入数据库，旧规格/加料需重新保存后同步。
  - ⏳ **未做**：菜品换图是 base64（超大图不入库，等第 4 期 Storage）；
    `point_records` 积分流水；通知中心跨设备（notifications 表未订阅）；骑手位置实时同步。
    注意：**前端内置演示数据的店铺 id 是 `'1'`~`'8'`，数据库是 UUID**——2b 做下单时必须用数据库 id，
    否则订单会引用到不存在的店铺。
- **第 3 期（Realtime）**：✅ **已上线（2026-09-27，第八版起）**，订单状态与 IM 消息跨设备实时同步。
  - 提交 `3a9d6b1` 已推送上线；「线上第七版跨设备需刷新」的历史问题不复存在（见 §1.1）。
  - 实现方式（`src/data/realtime.ts`）：**不解析推送载荷**，只把推送当"这张表有变化"的信号，
    然后调用 2a/2b/2c 各自的「从数据库重拉」函数（普通 SELECT，RLS 照常生效），
    再由它们派发原有的 CustomEvent。页面与业务逻辑因此**一行未改**。
    订阅 `orders` / `order_items`（合并成一次重拉订单）与 `messages` / `conversations`（重拉消息），
    300ms 防抖合并同一次写库产生的多条事件。
  - 订阅生命周期挂在 `useAuth` 里：登录建立、登出/切换账号拆除（换账号会重连，避免串号）。
  - **实时刷新时保住本地未写库的改动**：合并前先快照"已同步基线"，
    本地有改动（刚点接单/出餐、刚把未读清零）的订单/会话以本地为准，
    否则会被数据库里的旧值弹回去、而且再也写不回去。
    登录/换账号时的首次拉取仍是"以数据库为准"，与第 2 期行为一致。
  - **已执行（历史背景）**：`supabase/migrations/20260927010000_realtime_shop_config.sql`
    ——把 `conversations` 与商家侧配置表（shops / categories / dishes / shop_activities / 规格加料）
    一起加进 `supabase_realtime` publication。**只跑这一份即可**，它已覆盖旧的
    `20260927000000_realtime_conversations.sql`（两份都可重复执行，跑重了也无副作用）。
    不补的后果：对方把会话标记已读、新建会话，或商家改了菜品/店铺配置时，这边不实时刷新，
    要等下次手动刷新/重新登录才同步（订单与消息的实时不受影响，它们本来就在通道里）。
  - ✅ **已执行并实测（2026-09-28）**：自检 8 行 `in_realtime_pub = true`；用脚本对真实数据库验证
    「顾客端订阅 dishes / shops → 商家改一行 → 推送送达」（收到 dishes 2 条、shops 1 条）。
    ⚠️ **刚跑完 SQL 时不要立刻下结论**：实测那一刻新表还收不到推送（同时刻 orders 正常），
    约 1 分钟后重新建连接订阅就正常了——Realtime 服务会缓存 publication 的表清单，需要它重读一次。
  - ✅ **实测结论（2026-09-27，`node scripts/verify-realtime.mjs`，两个演示账号互测）**：
    顾客改单后，商家端在**默认 replica identity 下**正常收到推送，**不需要** `REPLICA IDENTITY FULL`。
    （一开始推断"orders 的读策略 `can_see_order` 要读多列，默认设置下更新事件会被静默丢弃"，
    随后实测**推翻了这一推断**：事件载荷里 `old` 只有 `id`，正说明用的就是默认设置。
    本项目收到推送后一律重新查库、不读事件载荷，所以 FULL 没有收益，只会增加 WAL 体积。）
  - 自检脚本 `scripts/verify-realtime.mjs`：双账号真连数据库跑一遍
    「顾客改单 → 商家端是否收到推送」，并带一个对照实验区分"通道不通"与"事件被丢弃"；
    对数据只做值不变的更新，不污染演示数据（用法见文件头注释）。
  - ⏳ **未做**：骑手位置的实时同步（原计划走 Realtime Broadcast 频道 `rider:{riderId}`），
    骑手坐标目前仍只在本机；`notifications` 表也还没订阅（通知仍是本地生成）。
- **第 4 期（Storage，可选）**：用户头像、评价图、商家换图改为 Supabase Storage 上传（替换 base64）。11 张菜品图已在本地 `public/images`，可继续保留。
- **第 5 期（Cloudflare Pages 部署）**：✅ **已完成（2026-09-27）**，线上地址 https://jianwei-57i.pages.dev/
  - 代码托管：GitHub 私有仓库 `https://github.com/Meinan818/jianwei`（私有，Cloudflare 已授权）。私有不影响部署；若要作品集公开，去仓库 Settings → Danger Zone 改可见性。
  - **实际构建口径（与原计划不同，以此为准）**：Build command = `npm run build:standalone`、Build output directory = `dist/client`、Production branch = `main`、Framework preset = `None`、环境变量留空（接完 Supabase 再补 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）。
  - **严禁让 Cloudflare 用 `npm run build`**：那是平台包装脚本，产物含 `{{appName}}` 占位符、外链统计脚本与妙搭水印，对外不可用。对外部署一律 `npm run build:standalone`。
  - `public/_redirects`（`/* /index.html 200`）已加入，实测直接访问 `/customer/orders`、`/merchant/orders` 均返回 200 而非 404。
  - Node 版本由仓库根目录 `.nvmrc`（22.16.0）固定，与 Cloudflare 构建镜像默认版本一致；Vite 8 要求 `^20.19.0 || >=22.12.0`。
  - 部署后已验证：HTTP 200、标题「饭否外卖」、无 HBS 占位符、无妙搭水印、无 Slardar/Tea 外链统计脚本、单个 JS chunk、真实浏览器渲染出三端选择器。
  - **环境变量已配置（2026-09-27）**：Cloudflare Pages → Settings → Variables and secrets 已加入
    `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（Production），线上已切换为真实认证与真实数据库。

### Supabase / Cloudflare 事实与注意

- 免费额度以官网实时说明为准，不要在文档里写死具体数值；免费项目长期闲置会自动休眠（唤醒后数据不丢失）。
- 不接真实短信 / 支付：验证码与 6 位支付密码演示值 `123456`，代码中保留真实接入点注释。
- RLS 是安全核心：商家只能改自己的店、用户只能读写自己的订单/地址/钱包、骑手按订单状态抢单，策略在 init migration 中已给出，改动表时同步检查 RLS。

### 2026-09-28 会话小结（第十二版，交接给下一个会话）

**本轮修掉的 7 个 bug**（全部是"只有真机点一遍才会暴露"的接线/数据问题，均已有回归脚本）：

1. 商家端「商品管理」永远卡加载：商家端没有任何地方触发 `ensureShopsLoaded()`；
2. 订单明细重复写入：`upsertOrder` 每次回写都重插明细（一笔订单 96/192 条）；
3. 商家拒单不生效：写库"先 INSERT"撞 RLS 42501 + `normalizeOrder` 状态白名单漏 `rejected`；
4. 拒单/取消后商家端看不到：`MerchantOrdersPage` 的「已完成」标签漏了 `rejected`/`cancelled`；
5. 购物车减号无效：传的是 `dishId`，而购物车按 `skuKey` 索引；
6. 骑手链路写不进库：把工号 `R0003` 当 uuid 写进 `orders.rider_id`；
7. 支付成功提示"支付失败"、抢单成功提示"已被抢走"：结果写在 setState 更新器里，而更新器延后执行
   （现在 `setOrders` 已包成同步执行版本，新增函数照旧写即可）。

**本轮新增功能**：顾客被拒单提醒（通知中心 + toast）、到店自取（不进抢单大厅 / 商家确认取餐即完成 / 顾客端提示）。

**工具**：`npm run smoke`（三端 18 页巡检）+ 7 个回归脚本（`scripts/e2e-*.html`，用法见各文件头与《交接说明》第五节）。

### 2026-09-29 会话小结（第十三版）

- `da6c3df` 已推送到 `main`，Cloudflare 自动部署；线上首页返回 HTTP 200、标题「饭否外卖」，实际脚本包含 `replace_dish_options`、`delete_custom_category` 与新保存提示。
- `20260929000000_shop_options_categories.sql` 已由用户在 Supabase SQL Editor 执行，返回 `Success. No rows returned`；用户随后反馈跨设备“同步”。
- 本地验证：`npx tsc -p tsconfig.app.json`、`npx eslint src`、`npm run build:standalone`、`npm run smoke` 通过；`supabase/gen/verify_local.mjs` 验证迁移可重复执行，以及规格/加料保存、失败回滚、清空、分类删除和权限边界。
- 后续注意：旧本机自定义分类不会自动迁移；旧规格/加料需重新保存。新功能还没有专门的自动化浏览器端到端回归脚本。

**下一步候选**：① 第 4 期图片上云（头像/评价图/换图 base64）；② 作品集材料（README/架构图/演示视频）；
③ 通知中心跨设备、骑手位置实时；④ 优惠券/钱包的浏览器端到端演示。

### 2026-09-29 · 第十四版验证、发布与新窗口交接

- 用户授权先验证优惠券和钱包：独立测试顾客真实注册，通过浏览器点击并读取本人数据库记录核对结果；模拟充值/支付，不接真实资金。测试账号与其业务记录保留，不删除数据。
- 新增 `scripts/e2e-coupon-wallet.html` / `.mjs` 与 `npm run verify:coupon-wallet`；使用真实时钟等待动画，日志和截图保存在 Git 忽略的 `logs/`，不输出登录凭证。
- 实际复现两处问题并修复 `PaymentPage`：余额付款没有渲染密码输入框；同一帧重复确认会进入两次支付，本机余额被扣两遍并弹矛盾提示。现在有密码弹层与同步 ref 防重复保护。
- 关键实测：红包抵扣 5 元，支付前状态 claimed、支付后 used；充值 50 元入库；错误密码不扣款；正确密码快速确认两次仍只扣 25 元、只有一条消费流水；页面/数据库余额均为 25 元，刷新后保留。
- 功能提交 `a684850` 已按用户授权 Push 到 `main`；回访线上首页及其实际脚本均为 HTTP 200，标题「饭否外卖」，脚本含「输入支付密码」「演示支付密码为 123456」「确认付款」三处本次修复标记。无需新增 SQL。提现、会员开通与网络失败恢复未在本轮验证。

### 新窗口接手要点（2026-09-29，本轮收尾）

- 先读本文件及 `docs/交接说明.md`，再查 `git status` / `git log --oneline -5`；本轮目标是代码与交接文档都已 Push、工作区干净。交接文档的最终提交号以 Git 为准，功能提交为 `a684850`。
- 既有检查在本会话上一步通过：`npm run typecheck`、`npx eslint src`、`npm run smoke`（构建 + 三端 18 页）、`npm run verify:coupon-wallet`。发布核验是 HTTP 与脚本内容检查，没有另外在线上重复完整下单。
- 本机证据：`logs/e2e-coupon-wallet-2026-09-29T05-17-59-793Z.log` 与同名 PNG；日志/截图、`.env.local`、构建产物不在 Git。回归每次注册独立账号并产生真实演示订单和钱包记录，记录保留；不要未经确认删除它们。
- 推荐下一步：先补钱包网络失败/恢复的验证，核对失败提示、余额、订单和流水是否一致；正常路径已通过，下一步应优先补异常路径。用户尚未授权这个新阶段，接手后先给清楚的范围和验证方案。图片上云、通知跨设备与作品集材料为后续候选。
- 用户最新用词偏好：对用户统一说「Push」；用户说「Push」即授权本次提交并发布。交接时主动给一个明确推荐、原因与用户可直接回复的话，不能只说“已读完，想做什么”。功能迭代才增加 `APP_EDITION`，本次交接文档收尾不升版。

### 2026-09-29 · 第十五版钱包异常修复（已 Push 并上线）

- 真实浏览器先复现：充值断网后页面虚增 50 元但数据库 0 元；余额支付断网后页面扣款并进入成功页，数据库未扣款却把订单推进；充值响应丢失后重试会重复入账。
- `20260929010000_wallet_idempotency.sql` 增加同用户同操作编号唯一约束，并新增 `apply_wallet_txn_once` 与 `pay_order_with_balance`。后者在一个数据库事务内完成余额扣减、单条流水和订单 `pending_payment → pending`。用户已在 Supabase SQL Editor 执行，截图确认自检返回 `idempotency_key text`。
- 充值和余额支付只有数据库确认后才更新页面；失败留在收银台并提示重试。充值操作编号随收银台 URL 保留；余额支付用订单 id 固定编号，响应丢失会同编号自动核对一次。
- 本地 SQL 模拟器验证迁移重复执行、同编号只入账一次、余额支付完整成功和余额不足完整回滚；`npx tsc -p tsconfig.app.json`、`npx eslint src`、`npm run smoke` 通过。真实浏览器 `npm run verify:wallet-network` 七项通过；`npm run verify:coupon-wallet` 原有正常链路通过。脚本注册独立测试顾客，测试记录保留；日志和截图在 Git 忽略的 `logs/`。
- `APP_EDITION` 已升到 15；用户亲手验收后授权 Push。功能提交 `ab9e581` 已 Push 到 `main`；线上首页 HTTP 200、标题「饭否外卖」，页面显示「第十五版」，实际脚本包含“付款未确认”“充值未确认”与 `balance-order:` 标记。下一步优先验证提现与会员开通端到端路径。

### 2026-09-29 · 第十六版会员开通（本地验收通过，生产尚未发布）

- 旧版点击“立即开通会员 · ¥15/月”直接写本机存储并提示成功，无付款、无数据库更新；本版已改为进入 ¥15 收银台。
- 本地已接入模拟微信、支付宝与余额支付。微信/支付宝不扣模拟钱包；余额付款须校验演示支付密码 `123456`，并在数据库事务内完成扣款、资格和单条流水。
- `20260929020000_membership_purchase.sql` 增加会员付款记录与事务函数 `purchase_membership`，固定 ¥15 / 30 天；同一操作编号重试不会重复收费或延长时间。用户已在 Supabase SQL Editor 执行，返回一行 `purchase_membership`。
- `npm run verify:membership` 真实数据库 5 环节通过：付款前非会员；取消、错误密码、断网都不扣款；响应丢失重试和快速双击只扣一次；刷新后会员/余额/有效期一致；清空浏览器缓存重新登录后仍从数据库恢复。
- 回归脚本 `scripts/e2e-membership.html` 修复了 iframe 同地址刷新不触发 `load` 导致超时的问题，并补了 10 秒超时保护。
- 本地已通过 `npm run test:membership`、`npx tsc -p tsconfig.app.json`、`npx eslint src`、`npm run build:standalone`、`npm run smoke`（三端 18 页）与用户亲手验收；`APP_EDITION` 已升到 16。
- 当前分支 `codex/membership-pending-sql`：会员功能代码、迁移、回归脚本和第十六版改动均在本地；生产 `main` 仍为 `040eb77`，线上仍是第十五版，尚未提交或 Push。
- 下一步只有两个选项：用户回复“存档”则本地 commit；用户回复“Push”则提交并发布到生产。此前不得把会员功能写成已上线。
## 7. 已知未修问题（P2，不阻断演示，可择机处理）

- 部分列表项内层动画首帧轻微透明（不影响首屏整体可见性）。
- 部分二级页（营销/财务/设置）卡片首帧轻微透明。
- 部分表单只有 toast 兜底校验，缺少完整的内联校验。
- 作品集加分项待补：README（技术栈/运行方式/亮点）、系统架构图、ER 图（设计稿 HTML 已有）、数据接口说明、2–3 分钟走单演示视频；文档中明确支付/短信为 Mock。

## 8. 对 AI 编程助手的工作要求

- 先读完本文件，涉及数据库时读 `supabase/migrations/` 两个 SQL，涉及控制台操作读 `docs/Supabase控制台操作清单.md`。
- 每完成一个改动：`npx tsc -p tsconfig.app.json` 必须 0 错误、`npm run build:standalone` 必须通过，再 git commit；commit message 用简体中文，写清改动。
- 每个用户可见的功能完成自动测试后，都要给用户一套 **1–3 分钟亲手验收步骤**：写清页面链接、点什么、预期看到什么，并明确当前验收的是本地版还是线上版。需要本地预览时可启动服务并提供链接；**不要主动打开浏览器或切换用户的标签页**，除非用户明确要求。用户完成观感验收后再进入提交 / Push 决策。
- 功能交付汇报保持详细且可核对：一句话结论 → 按文件说明改动 → 真实命令与真实结果 → 用户亲手验收步骤 → 当前是否已提交、Push、上线 → 下一步。不要只说“测试通过”或让用户自己猜该测什么。
- 不要擅自引入新依赖、更换技术栈、改变视觉风格；不要做一账号多店；不要恢复自动回复。
- 遇到必须由人工完成的步骤（注册 Supabase、拿密钥、Cloudflare 登录），明确列出操作步骤让用户做，不要假装完成。
- 保持暖橙品牌、克制动画、移动端竖屏、简体中文。

### 8.1 存档 / 推送 / 部署的固定节奏（2026-09-27 约定，2026-09-28 二次修订：推送前先问用户）

**2026-09-28 最新口径（用户拍板）**：AI 可以自行 `git commit` 存档，但
**推送（`git push`）之前必须先问用户**，不再自动推送。
（与本机全局约定一致：「提交与推送：只有他说『提交 / 存档 / 推送』才做」。）
执行口径如下：

1. **改完代码必须先自己跑一遍，确认真的能正常运行**（2026-09-28 用户明确要求）：
   - `npx tsc -p tsconfig.app.json` 必须 0 错误、`npx eslint src` 必须通过；
   - `npm run build:standalone` 必须通过；
   - `npm run smoke`：无头 Chrome 起真机冒烟，三端各真实登录一次、逐个主要页面检查
     「落进错误兜底 / 卡在加载 / 白屏」。**这一步不能省**——2026-09-28 的两个 bug
     （商家端「商品管理」永远卡在加载、订单明细被重复写入）tsc / eslint / 构建**全都发现不了**，
     只有在真浏览器里点一遍才暴露。
   - 冒烟跑不了（没网 / 本机没有 Chrome）时**如实说明原因**，不要假装跑过。
2. 验证通过后 `git commit` 存档（commit message 用简体中文写清改动）。
3. **推送前先问用户**：汇报时明确写一句「要不要推送？」，并说明影响——
   push 到 `main` 就是线上发布，Cloudflare 会在 1–3 分钟内自动重新构建。
   用户说「推 / 推送」再 `git push`；他说「先不推」就留在本地，攒到下次一起推。
   ⚠️ 提醒：**不推送时线上仍是旧版**。用户习惯直接在线上地址验收，
   所以凡是「需要他去线上测」的改动，汇报里要主动说清"现在推了没 / 要不要先推再看"。
4. 推送后至少回访一次线上地址，确认能打开、标题为「饭否外卖」，
   并**用内容标记确认本次改动已进去**（不要比对 bundle 文件名——Cloudflare 产物哈希与本地不同）。
   ⚠️ **验证线上是哪一版不要比对 bundle 文件名**——Cloudflare 构建产物的 chunk 哈希与本地不同
   （同一次提交本地 `index-DaF7W2U0.js`、线上可能是 `index-DdK9-DMk.js`）。
   正确做法：从线上 index.html 取 script src，`curl --compressed` 拉该 JS，grep 本次改动独有的
   console 字符串（内容标记）。直连下载大文件必须加 `--compressed`，否则 3MB bundle 容易超时。
5. 每次动手前先 `git status`，若发现用户自己改的、尚未存档的内容，一并提交，**不要覆盖**。
6. 本机 git 访问 GitHub 依赖代理配置 `http.https://github.com.proxy`（FlClash 的本地混合端口）。**代理未开启、或端口变了，推送都会失败，此时提醒用户开启代理，不要反复重试。**
   - 2026-09-27 记录：端口最初是 `7890`，后发现 FlClash 已改用 `10909`（与 Windows 系统代理设置一致），配置已更新为 `http://127.0.0.1:10909`。
  - 2026-09-27 再次记录：端口又变为 `10910`（FlClash 重排端口），注册表 `ProxyServer` 与 git 配置一致，
    即 `http://127.0.0.1:10910`；以后端口再变，先读注册表再同步 git 配置。
   - 2026-09-27 补充：FlClash **开 TUN 模式时**系统代理是关闭的（注册表 `ProxyEnable=0`）、也没有任何 HTTP 代理端口在监听（核心进程只监听 53 做 DNS），
     此时 git 里配置的代理端口必然连不上——先查 FlClash 当前模式；TUN 模式下用
     `git -c http.https://github.com.proxy= push` 绕过代理直连即可（TUN 会接管流量）。
   - 端口再次失效时，最快的定位方法：读注册表 `HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings` 的 `ProxyServer`（FlClash 会把自己的端口写在这里），再同步更新 git 配置；也可临时用 `git -c http.https://github.com.proxy= <命令>` 绕过代理直连试试（国内直连时通时断，不宜长期依赖）。
7. 改动与推送的结果要主动告知用户（改了什么、线上现在是什么版本）。
8. **每完成一次「迭代」后，把 `src/data/app-meta.ts` 里的 `APP_EDITION` 加 1**（用户约定的"每次迭代再改"）。
   - 判定口径（2026-09-27 用户明确）：**一个完整的功能 / 界面改动算一次迭代**；纯文档整理、中间步骤、规则修正**不递增**。
   - 它同时驱动三端设置页的版本号（`APP_VERSION` = `v{APP_EDITION}.0.0`）与启动页底部彩蛋文案「大野鸡第 N 版原型演示版本」，
     只改这一个数字，不要在各页面散写版本号。
   - 版次变化可作为"这次迭代确实上线了"的肉眼验证；但**文档类提交推送后线上版本号不变是正常的**，不要为此反复调整。

## 9. 安全与环境变量（2026-09-27 由 Codex 补充）

- `.env`、`.env.*` 已被 `.gitignore` 忽略；提交前用 `git status --short` 确认待提交列表里没有任何 `.env` 文件。
- 变量名只写在 `.env.example`，真实值写进 `.env.local`（不入库）。
- 前端只允许放 anon / publishable key；service_role / secret key 严禁出现在前端代码、文档、提交信息或聊天里。
- 任何 API Key、Token、数据库密码、云平台凭证都不得写进代码、日志或 Git 历史；怀疑泄露先提醒用户。
- 涉及删除数据、部署生产、修改账号权限的操作，先取得用户确认。

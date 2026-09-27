# 简味点单 — AI 编程助手交接文档（AGENTS.md）

> 本文件是项目的**唯一权威交接说明**。仓库内旧的 `README.md`（仅技术规范）与本文件冲突时，以本文件为准。
> 你（AI 编程助手，如 Codex）看不到原开发对话，所有上下文都在本文件和 `docs/`、`supabase/` 中。请先完整读完本文件再动手。

> **品牌名约定（2026-09-27 用户拍板）**：对用户展示的品牌是「**饭否外卖**」（网页标题、启动页、三端设置页、用户协议、示例店铺名都用它）；
> 「简味点单 / jianwei」只是**项目代号**，继续用于文件夹名、GitHub 仓库名、本文件名与内部文档。
> 品牌名与版次集中在 `src/data/app-meta.ts`，不要在页面里再写死。

---

## 1. 项目定位（决定所有取舍）

- 「简味点单」是一款**顾客端 + 商家端 + 骑手端**三端联动的外卖 App，对标美团 / 饿了么，包含丰富但克制的动画。
- 性质：**大学课程 / 个人作品集项目**，不商业化运营。优先级：零成本 > 可演示 > 功能完整。
- **不接真实支付、不接真实短信、不上架应用商店**——这些功能用 Mock 实现，并在代码与文档中注明"已预留真实接入点"。
- 阶段路线（2026-09-27 更新）：
  1. 前端高保真原型（**已完成**，原型版本 v60）；
   2. 接入真实后端数据库（**✅ 第 2 期已全部完成（2026-09-27）**：账号/店铺/菜品/订单/聊天/地址/评价/售后/异常/优惠券/钱包全部上云）；
  3. 部署到 Cloudflare Pages 上线演示（**已完成**：https://jianwei-57i.pages.dev/ ）；
  4. 实时推送（第 3 期，**✅ 已上线（第八版）**：数据库里改一行，其他端不刷新就能看到；
     补一条 SQL（conversations 进 Realtime publication）仍待执行，见第 6 节「第 3 期」与 §1.1）；
  5. 续做（第 2 期已于 2026-09-27 全部完成）：商家侧配置类写操作上云（上下架/营销编辑）、
     通知中心跨设备（notifications 表订阅）、第 4 期图片上云（Storage，可选）、作品集材料（可选）。
- **给人看的交接摘要见 `docs/交接说明.md`**（含演示账号、演示脚本、线上资产清单、已知的坑）。
- 原生套壳 App（Android/iOS 安装包）不是目标，产品形态是**移动端竖屏网页应用**。

### 1.1 当前进度快照（2026-09-27，动手前先看这里）

| 项 | 现状 |
|---|---|
| 线上站点 | **第十版**（第 2 期数据上云全部完成；第八版起跨设备看新订单/新消息**不用刷新**） |
| 本地 `main` | 与 `origin/main` 同步 |
| 关键提交 | `3a9d6b1` 第 3 期实时推送；`ded36a4` 2d 地址；`0866a2b` 2e 评价/售后/异常；`477e16f` 2f 优惠券；`92d623b` 2g 钱包 |
| 已在真机验证 | `node scripts/verify-realtime.mjs`：顾客改单 → 商家端不刷新即收到 |
| 尚未验证 | 浏览器里的实际观感（两台设备开着页面互看）；2e/2f/2g 的浏览器端到端演示 |
| 待人工操作 | 在 Supabase 跑 `20260927000000_realtime_conversations.sql`（不跑不影响订单/消息实时，仅会话已读/新会话不实时） |

> 开工前若发现本地还有**未 push 的提交**，先跟用户确认要不要推，不要把半成品直接推上线。

## 2. 技术栈

- 前端：React 19 + TypeScript + Vite 8（SPA）
- 样式：Tailwind CSS v4（主题变量在 `src/tailwind-theme.css`）
- UI 组件：shadcn/ui（基于 Radix UI，组件在 `src/components/ui/`）
- 路由：react-router-dom
- 动画：framer-motion（另有 @formkit/auto-animate、GSAP）
- 图表：echarts-for-react
- 图标：lucide-react
- 后端（待接入）：Supabase（托管 PostgreSQL + Auth + PostgREST + Realtime + Storage）
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
- **IM 排版硬约束**：本人消息整行靠右、本人头像最右贴边、气泡在头像左侧；对方头像最左、消息靠左。**没有自动回复功能（曾被删除，禁止恢复）**。
- 聊天页订单条/店铺条、快捷短语只在有数据时渲染。

### 4.5 数据、图片、动画、错误兜底现状

- 数据：全部在浏览器 localStorage（通过平台 scopedStorage 封装）。演示数据由真实操作驱动，**禁止写死演示订单/会话**。
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

## 6. 后端迁移与部署进展（第 0 / 1 / 2a / 2b / 2c / 3 / 5 期已完成，续做第 2 期剩余与第 4 期）

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
  - ⏳ **未做**：商家侧配置类写操作（上下架/营销活动编辑）仍在本机 localStorage；
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
  - ⚠️ **需要执行一条 SQL 才完全生效**：`supabase/migrations/20260927000000_realtime_conversations.sql`
    ——把 `conversations` 加进 `supabase_realtime` publication。
    orders / order_items / messages 本来就在通道里（init 脚本加的），**唯独 conversations 漏了**；
    不补的后果：对方把会话标记已读、或新建会话时这边不实时刷新，
    要等有新消息、由 messages 的事件把会话一起重拉回来才同步。
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

## 7. 已知未修问题（P2，不阻断演示，可择机处理）

- 部分列表项内层动画首帧轻微透明（不影响首屏整体可见性）。
- 部分二级页（营销/财务/设置）卡片首帧轻微透明。
- 部分表单只有 toast 兜底校验，缺少完整的内联校验。
- 作品集加分项待补：README（技术栈/运行方式/亮点）、系统架构图、ER 图（设计稿 HTML 已有）、数据接口说明、2–3 分钟走单演示视频；文档中明确支付/短信为 Mock。

## 8. 对 AI 编程助手的工作要求

- 先读完本文件，涉及数据库时读 `supabase/migrations/` 两个 SQL，涉及控制台操作读 `docs/Supabase控制台操作清单.md`。
- 每完成一个改动：`npx tsc -p tsconfig.app.json` 必须 0 错误、`npm run build:standalone` 必须通过，再 git commit；commit message 用简体中文，写清改动。
- 不要擅自引入新依赖、更换技术栈、改变视觉风格；不要做一账号多店；不要恢复自动回复。
- 遇到必须由人工完成的步骤（注册 Supabase、拿密钥、Cloudflare 登录），明确列出操作步骤让用户做，不要假装完成。
- 保持暖橙品牌、克制动画、移动端竖屏、简体中文。

### 8.1 存档 / 推送 / 部署的固定节奏（2026-09-27 与用户约定）

用户要求 AI 在今后每次修改时代为**存档并上传 GitHub**。执行口径如下：

1. 改完代码先跑 `npx tsc -p tsconfig.app.json`（必须 0 错误）与 `npm run build:standalone`（必须通过）。
2. 验证通过后 `git commit` 存档，commit message 用简体中文写清改动内容。
3. **只在「一个阶段完成且验证通过」后才 `git push`**：Cloudflare 已连 GitHub，推送到 `main` 即等于线上发布，半成品不要推。
4. 推送后 Cloudflare 自动重新构建，约 1–3 分钟上线；上线后至少回访一次线上地址，确认能打开且标题为「饭否外卖」。
   ⚠️ **验证线上是哪一版不要比对 bundle 文件名**——Cloudflare 构建产物的 chunk 哈希与本地不同
   （同一次提交本地 `index-DaF7W2U0.js`、线上可能是 `index-DdK9-DMk.js`）。
   正确做法：从线上 index.html 取 script src，`curl --compressed` 拉该 JS，grep 本次改动独有的
   console 字符串（内容标记）。直连下载大文件必须加 `--compressed`，否则 3MB bundle 容易超时。
5. 每次动手前先 `git status`，若发现用户自己改的、尚未存档的内容，一并提交，**不要覆盖**。
6. 本机 git 访问 GitHub 依赖代理配置 `http.https://github.com.proxy`（FlClash 的本地混合端口）。**代理未开启、或端口变了，推送都会失败，此时提醒用户开启代理，不要反复重试。**
   - 2026-09-27 记录：端口最初是 `7890`，后发现 FlClash 已改用 `10909`（与 Windows 系统代理设置一致），配置已更新为 `http://127.0.0.1:10909`。
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

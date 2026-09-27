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
- 阶段路线：
  1. 前端高保真原型（**已完成**，当前版本 v60）；
  2. 接入真实后端数据库（**下一步，选型 Supabase**）；
  3. 前端自行部署到 Cloudflare Pages 上线演示。
- 原生套壳 App（Android/iOS 安装包）不是目标，产品形态是**移动端竖屏网页应用**。

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
npx vite build           # 生产构建，产物在 dist/
npx tsc -p tsconfig.app.json   # 类型检查（必须 0 错误）
```

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
- 消息更新监听：CustomEvent + storage 双监听（接入 Supabase 后改为 Realtime）。
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

## 6. 下一步任务：Supabase 迁移 + Cloudflare 部署

### 已提供的后端资产（在 `supabase/` 与 `docs/`）

- `supabase/migrations/20260915000000_init_schema.sql`：初始化库结构——24 张表、16 个枚举、56 条 RLS 策略、3 个 RPC（`apply_wallet_txn`、`claim_order`、`reply_review`）、3 个 Storage 桶（avatars、dish-images、review-images）；含 `handle_new_user` 触发器（从注册元数据 role 自动建 profile）；Realtime publication 覆盖 orders/order_items/messages/notifications/refund_requests/delivery_exceptions。
- `supabase/migrations/20260915010000_seed_demo.sql`：演示数据——9 家店、26 个分类、62 道菜、6 张券、3 个演示账号。演示账号：
  - `demo-customer@jianwei.app` / `demo-merchant@jianwei.app` / `demo-rider@jianwei.app`，密码均为 `123456`。
  - 跑完后的自检期望：shops=9、categories=26、dishes=62、coupons=6、auth.users=3。
- `supabase/gen/gen_seed.py`：seed 生成器（改演示数据后 `python3 supabase/gen/gen_seed.py > supabase/migrations/20260915010000_seed_demo.sql`）。
- `docs/Supabase控制台操作清单.md`：在 Supabase 控制台的逐步操作手册。
- `docs/简味点单-Supabase数据库设计稿.html`：数据库设计可视化（ER 图、枚举、RLS 说明），浏览器直接打开。

### 迁移分期（建议严格按期推进，每期都要 tsc 0 + build 过 + git commit）

- **第 0 期（人工，在 Supabase 控制台）**：注册 Supabase → 新建项目，**区域选 Singapore（新加坡）或 Tokyo（东京），区域创建后不可更改** → SQL Editor 依次跑 init、seed 两个 migration → Auth 设置里关闭 "Confirm email"（否则演示账号无法直接登录）→ 拿到 Project URL 和 anon public key（注意：anon key 设计上就是公开的，安全完全靠 RLS；**service_role key 严禁放进前端**）。
- **第 1 期（Auth）**：安装 `@supabase/supabase-js`；新建 client，读环境变量 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`；用 Supabase Auth 替换 `useAuth` 的模拟登录（邮箱 + 密码走真实认证；短信验证码保持前端 Mock `123456`，注明真实短信接入点）；三端账号角色与 profiles 表对齐。
- **第 2 期（业务数据）**：把 shops / shop_settings / categories / dishes / orders / order_items / addresses / messages / reviews / coupons / 会员钱包 / notifications 从 localStorage 逐步改为 Supabase 查询。**开工前先以当前前端源码为准做一次字段对账**：前端数据模型（见第 4 节，尤其 9 态订单枚举、会话 id 模型、未读三字段）与 SQL 表结构有差异时，新增 ALTER migration 补齐，不要推翻已有 24 张表。
- **第 3 期（Realtime）**：用 Realtime 订阅替换 CustomEvent/storage 监听，实现订单状态、IM 消息、骑手位置三端实时同步。
- **第 4 期（Storage，可选）**：用户头像、评价图、商家换图改为 Supabase Storage 上传（替换 base64）。11 张菜品图已在本地 `public/images`，可继续保留。
- **第 5 期（Cloudflare Pages 部署）**：✅ **已完成（2026-09-27）**，线上地址 https://jianwei-57i.pages.dev/
  - 代码托管：GitHub 私有仓库 `https://github.com/Meinan818/jianwei`（私有，Cloudflare 已授权）。私有不影响部署；若要作品集公开，去仓库 Settings → Danger Zone 改可见性。
  - **实际构建口径（与原计划不同，以此为准）**：Build command = `npm run build:standalone`、Build output directory = `dist/client`、Production branch = `main`、Framework preset = `None`、环境变量留空（接完 Supabase 再补 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）。
  - **严禁让 Cloudflare 用 `npm run build`**：那是平台包装脚本，产物含 `{{appName}}` 占位符、外链统计脚本与妙搭水印，对外不可用。对外部署一律 `npm run build:standalone`。
  - `public/_redirects`（`/* /index.html 200`）已加入，实测直接访问 `/customer/orders`、`/merchant/orders` 均返回 200 而非 404。
  - Node 版本由仓库根目录 `.nvmrc`（22.16.0）固定，与 Cloudflare 构建镜像默认版本一致；Vite 8 要求 `^20.19.0 || >=22.12.0`。
  - 部署后已验证：HTTP 200、标题「简味点单」、无 HBS 占位符、无妙搭水印、无 Slardar/Tea 外链统计脚本、单个 JS chunk、真实浏览器渲染出三端选择器。

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
5. 每次动手前先 `git status`，若发现用户自己改的、尚未存档的内容，一并提交，**不要覆盖**。
6. 本机 git 访问 GitHub 依赖代理配置 `http.https://github.com.proxy`（FlClash 的本地混合端口）。**代理未开启、或端口变了，推送都会失败，此时提醒用户开启代理，不要反复重试。**
   - 2026-09-27 记录：端口最初是 `7890`，后发现 FlClash 已改用 `10909`（与 Windows 系统代理设置一致），配置已更新为 `http://127.0.0.1:10909`。
   - 端口再次失效时，最快的定位方法：读注册表 `HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings` 的 `ProxyServer`（FlClash 会把自己的端口写在这里），再同步更新 git 配置；也可临时用 `git -c http.https://github.com.proxy= <命令>` 绕过代理直连试试（国内直连时通时断，不宜长期依赖）。
7. 改动与推送的结果要主动告知用户（改了什么、线上现在是什么版本）。
8. **每次完成改动，把 `src/data/app-meta.ts` 里的 `APP_EDITION` 加 1**（用户约定的"每改一次就变成第几版"）。
   它同时驱动三端设置页的版本号（`APP_VERSION` = `v{APP_EDITION}.0.0`）与启动页底部彩蛋文案「大野鸡第 N 版原型演示版本」，
   所以只需要改这一个数字，不要在各页面散写版本号。改完后线上地址会立刻反映新版次，可作为"这次改动确实上线了"的肉眼验证。

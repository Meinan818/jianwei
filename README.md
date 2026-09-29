# 饭否外卖

> 基于 React + TypeScript + Supabase 的全栈外卖应用，包含顾客端、商家端、骑手端三端联动，支持实时推送、会员钱包、订单管理等完整业务流程。

<p align="center">
  <a href="https://jianwei-57i.pages.dev/">在线演示</a> ·
  <a href="#功能特性">功能特性</a> ·
  <a href="#技术栈">技术栈</a> ·
  <a href="#快速开始">快速开始</a>
</p>

---

## 项目简介

饭否外卖是一个全栈外卖点单系统，模拟美团/饿了么的核心业务流程。项目采用前后端分离架构，前端基于 React 19 + TypeScript 构建，后端使用 Supabase 提供认证、数据库和实时推送能力。

**在线演示**：https://jianwei-57i.pages.dev/

**演示账号**：
- 顾客端：`13800000001` / `123456`
- 商家端：`13800000002` / `123456`
- 骑手端：`13800000003` / `123456`

---

## 功能特性

### 核心业务流程
- **三端联动架构**：顾客、商家、骑手独立账号池，订单状态实时同步
- **完整订单流程**：浏览店铺 → 下单支付 → 商家接单 → 骑手配送 → 送达评价
- **9 态订单状态机**：支持待支付、待接单、备餐中、待取餐、配送中、已送达、已取消、已拒单、到店自取
- **超时处理**：支付超时自动取消，商家接单超时提醒，可催单或取消订单

### 会员与钱包系统
- **余额充值与消费**：支持微信、支付宝、余额支付（演示实现）
- **支付幂等性保证**：网络失败重试不会重复扣款，操作编号去重
- **会员开通**：¥15/月，支持余额支付，数据库事务保证原子性
- **提现功能**：支持提现到支付宝/微信/银行卡（演示 3 秒到账）
- **成长体系**：消费累计成长值，自动升级会员等级

### 商家端配置管理
- **菜品管理**：上下架、售罄、价格调整、库存管理
- **规格与加料**：菜品规格（大/中/小）、加料选项（辣度、口味）
- **营销活动**：满减优惠、新人券、限时折扣
- **实时同步**：商家改价后，顾客端不刷新即可看到（Supabase Realtime）

### 社交与服务
- **IM 聊天**：顾客与商家实时沟通，骑手与商家协调取餐
- **通知中心**：订单状态变化、拒单提醒、优惠券到账等消息推送
- **评价系统**：五星评价 + 图文评价，商家可回复
- **售后退款**：顾客申请退款，商家审核处理
- **配送异常**：超时、物品损坏等异常上报

---

## 技术栈

### 前端技术
- **框架**：React 19 + TypeScript
- **构建工具**：Vite 8
- **样式方案**：Tailwind CSS v4 + shadcn/ui
- **路由管理**：React Router v7
- **动画库**：Framer Motion + GSAP + Auto Animate
- **状态管理**：React Context + Hooks
- **图表组件**：ECharts

### 后端技术
- **BaaS 平台**：Supabase
- **数据库**：PostgreSQL（24 张表，56 条 RLS 权限策略）
- **认证系统**：Supabase Auth（邮箱/密码登录）
- **实时推送**：Supabase Realtime（基于 PostgreSQL LISTEN/NOTIFY）
- **存储**：Supabase Storage（头像、评价图片）

### 工程化
- **类型检查**：TypeScript strict mode，编译 0 错误
- **代码规范**：ESLint + Prettier
- **自动化测试**：Playwright 端到端测试（真浏览器 + 真数据库）
- **部署平台**：Cloudflare Pages（自动构建 + CDN 加速）

---

## 数据库设计

### 核心表结构
- **用户与认证**：`profiles`（用户资料）、`auth.users`（认证表）
- **商家与菜品**：`shops`、`categories`、`dishes`、`dish_options`（规格）、`dish_addons`（加料）
- **订单流程**：`orders`、`order_items`、`addresses`
- **会员钱包**：`wallet_transactions`（流水）、`withdraw_records`（提现）、`membership_purchases`（会员付款）
- **社交互动**：`messages`、`conversations`、`notifications`、`reviews`
- **营销优惠**：`coupons`、`user_coupons`、`shop_activities`
- **售后服务**：`refund_requests`、`delivery_exceptions`

### 权限控制（RLS）
- 商家只能修改自己的店铺和菜品
- 顾客只能读写自己的订单和地址
- 骑手按订单状态抢单，不能跨单操作
- 钱包流水只能本人查看，余额修改走 RPC 事务函数

### 原子事务设计
- **余额支付**：`pay_order_with_balance` RPC，扣款 + 写流水 + 订单状态推进，三者原子完成
- **会员开通**：`purchase_membership` RPC，扣款 + 会员资格 + 付款记录，支持幂等重试
- **钱包记账**：`apply_wallet_txn_once` RPC，同操作编号重试不重复入账

完整 ER 图见：`supabase/简味点单-Supabase数据库设计稿.html`

---

## 快速开始

### 环境准备
- Node.js 20.19.0+（推荐使用 22.16.0）
- npm 10+
- Git

### 本地运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/Meinan818/jianwei.git
   cd jianwei
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   
   创建 `.env.local` 文件（可选，未配置时使用本地 Mock）：
   ```env
   VITE_SUPABASE_URL=你的_Supabase_项目URL
   VITE_SUPABASE_ANON_KEY=你的_Supabase_公开密钥
   ```

   > 获取方式：注册 [Supabase](https://supabase.com/) → 新建项目 → Settings → API → Project URL & anon public key

4. **初始化数据库**（如果配置了 Supabase）
   
   在 Supabase SQL Editor 中依次执行：
   - `supabase/migrations/20260915000000_init_schema.sql`（库结构）
   - `supabase/migrations/20260915010000_seed_demo.sql`（演示数据）
   - 其他迁移文件（按文件名顺序）

   详细步骤见：`docs/Supabase控制台操作清单.md`

5. **启动开发服务器**
   ```bash
   npx vite
   ```
   
   访问：http://localhost:5173

### 构建与部署

```bash
# 类型检查（必须 0 错误）
npx tsc -p tsconfig.app.json

# 代码检查
npx eslint src

# 构建生产版本
npm run build:standalone

# 自动化测试（需要先构建）
npm run smoke  # 三端 18 页冒烟测试
```

**部署到 Cloudflare Pages**：
1. 连接 GitHub 仓库
2. Build command: `npm run build:standalone`
3. Build output directory: `dist/client`
4. 添加环境变量：`VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

---

## 项目亮点

### 1. 实时推送（Supabase Realtime）
- 基于 PostgreSQL 的 LISTEN/NOTIFY 机制，非轮询
- 顾客下单后，商家端不刷新即可看到新订单
- 商家改价后，顾客端实时显示新价格
- 骑手抢单后，商家端实时显示骑手信息

### 2. 支付幂等性保证
- 操作编号（idempotency key）去重
- 网络失败重试不会重复扣款
- 响应丢失后，前端自动核对数据库状态
- 数据库唯一约束 + RPC 事务双重保障

### 3. 三端独立架构
- 顾客、商家、骑手各自独立的账号池和权限体系
- 端内不跨端跳转，避免角色混淆
- 数据库 RLS 策略保证权限隔离
- 业务数据跨端联动（订单、消息、通知）

### 4. 9 态订单状态机
- 覆盖待支付、待接单、备餐、配送、送达、取消、拒单、自取全流程
- 超时规则：支付 15 分钟、商家接单 8 分钟
- 异常处理：拒单原因、取消原因、配送异常上报
- 状态转换守卫：数据库触发器拦截非法跳转

### 5. 自动化测试
- 真实浏览器（Playwright）+ 真实数据库（Supabase）
- 覆盖完整业务流程：注册 → 下单 → 支付 → 接单 → 配送 → 评价
- 网络异常模拟：断网、响应丢失、重复提交
- 幂等性验证：双击只扣一次款、重试不重复入账

---

## 项目结构

```
jianwei-codex/
├── src/
│   ├── pages/               # 页面模块
│   │   ├── customer/        # 顾客端（店铺、订单、会员）
│   │   ├── merchant/        # 商家端（商品、订单、财务）
│   │   └── rider/           # 骑手端（抢单、配送）
│   ├── components/          # 通用组件
│   │   └── ui/              # shadcn/ui 基础组件
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useAuth.tsx      # 认证与登录
│   │   ├── useOrders.tsx    # 订单状态管理
│   │   ├── useWallet.tsx    # 钱包与会员
│   │   └── useMessages.tsx  # 聊天与通知
│   ├── data/                # 数据层
│   │   ├── *-remote.ts      # Supabase 数据库操作
│   │   └── realtime.ts      # 实时推送订阅
│   └── lib/                 # 工具函数
├── supabase/
│   ├── migrations/          # 数据库迁移脚本
│   └── gen/                 # SQL 生成器
├── scripts/                 # 自动化脚本
│   ├── e2e-*.html           # 端到端测试
│   └── e2e-*.mjs            # 测试驱动脚本
├── docs/                    # 项目文档
│   ├── 交接说明.md
│   ├── Supabase控制台操作清单.md
│   └── 简味点单-Supabase数据库设计稿.html
└── public/
    └── images/              # 真实菜品图片（11 张）
```

---

## 开发说明

### 代码规范
- **类型安全**：所有组件和函数必须有明确的 TypeScript 类型
- **命名约定**：组件用 PascalCase，hooks 用 use 前缀，工具函数用 camelCase
- **提交规范**：`feat/fix/docs/chore(scope): message`（简体中文）

### 数据流
```
用户操作 → Hooks（业务逻辑）→ *-remote.ts（数据库操作）→ Supabase
                                                           ↓
页面组件 ← Context 更新 ← realtime.ts 订阅 ← Supabase Realtime 推送
```

### 测试命令
```bash
npm run smoke                    # 三端 18 页冒烟测试
npm run verify:coupon-wallet     # 优惠券与钱包完整流程
npm run verify:wallet-network    # 钱包网络异常恢复
npm run verify:membership        # 会员开通 5 环节验证
```

---

## 已知限制

1. **支付与短信为演示实现**
   - 验证码固定 `123456`（代码已预留真实短信接入点）
   - 微信/支付宝支付为前端 Mock（余额支付真实扣数据库）
   - 支付密码固定 `123456`（未接真实密码加密）

2. **图片上传**
   - 当前头像和评价图存 base64（已预留 Supabase Storage 接入点）
   - 菜品图片使用 `public/images/` 下的 11 张真实图片

3. **部分功能待完善**
   - 通知中心跨设备推送（表已建，订阅未开启）
   - 骑手位置实时同步（规划中）
   - 积分流水明细展示（数据库有表，前端未展示）

---

## 更新日志

### v16 (2026-09-29)
- ✨ 会员开通真实数据库接入
- 🔒 支付幂等性保证（操作编号去重）
- 🧪 新增会员开通端到端测试
- 📝 补充协同开发文档

### v15 (2026-09-29)
- 🔧 钱包断网恢复与重复记账修复
- ⚡ 余额支付原子事务（数据库 RPC）
- 🧪 新增钱包网络异常测试

### v13 (2026-09-29)
- ✨ 规格/加料一次性写库并支持清空
- ✨ 自定义分类新增、重命名、删除写库

### v8-v12 (2026-09-27 - 2026-09-28)
- ✨ 实时推送上线（订单、消息、店铺配置）
- ✨ 商家端配置写操作上云
- 🐛 修复 7 个真机验收发现的 bug
- ✨ 顾客被拒单提醒、到店自取功能

### v1-v7 (2026-09-15 - 2026-09-27)
- 🎉 项目初始化，三端基础页面
- ✨ 认证系统、店铺数据、订单流程上云
- ✨ 地址、评价、售后、优惠券、钱包上云
- 🚀 Cloudflare Pages 部署上线

---

## 协议与声明

本项目为**课程作业 / 个人作品集项目**，不用于商业运营。

- 项目代码：MIT License
- 真实图片：来源于公开素材，仅用于演示
- 支付与短信：演示实现，未接入真实服务

---

## 联系方式

- 项目仓库：https://github.com/Meinan818/jianwei
- 在线演示：https://jianwei-57i.pages.dev/

---

**开发时间**：2026 年 9 月（16 个迭代版本）  
**技术栈**：React 19 + TypeScript + Supabase  
**部署平台**：Cloudflare Pages

# Supabase 控制台操作清单（照着打勾，约 10 分钟）

> 目标：建好云端数据库 → 跑完两个 SQL → 关闭邮箱验证 → 把两个连接参数交给 AI，由 AI 做第 1 期（真实登录）。
> 全程免费；用电脑浏览器操作最方便（手机也能做，但复制 SQL 不方便）。
> 本清单已按 2026-09 的 Supabase 控制台核对过一遍。

## ⚠️ 先记住：密钥改名了

Supabase 正在废弃旧的 `anon` / `service_role` 密钥，改用新的 `publishable` / `secret`（计划 2026 年底前完成迁移）。
所以你在控制台里可能看到新旧两套名字，它们指的是同一个位置：

| 新名字 | 旧名字 | 能不能给前端 / 发给 AI |
|---|---|---|
| `Publishable key`（`sb_publishable_...`） | `anon` `public` | ✅ 可以，本来就是公开的 |
| `Secret key`（`sb_secret_...`） | `service_role` | ❌ **绝对不行**，它能绕过所有权限 |

## ① 注册并创建项目（约 3 分钟）

- [ ] 打开 https://supabase.com → 用邮箱或 GitHub 注册账号
- [ ] 点 **New project**
  - Name：`jianwei`（随意）
  - Database Password：点 **Generate a password**，把生成的密码**存到备忘录**（以后基本用不到，但丢了要重置）
  - **Region：选 `Southeast Asia (Singapore)` 新加坡**（离中国最近；⚠️ 区域创建后不可更改，别选美西）
  - Pricing：Free 免费档即可
- [ ] 点创建，等约 2 分钟初始化完成

## ② 执行建表脚本（约 3 分钟）

- [ ] 左侧 **SQL Editor** → **New query**
- [ ] 用 VS Code 打开 `supabase/migrations/20260915000000_init_schema.sql`，`Ctrl+A` 全选、`Ctrl+C` 复制，粘贴进编辑器 → 点 **Run**
  - 成功标志：底部显示 `Success. No rows returned`，没有红色报错
- [ ] 再 **New query**，同样方式跑 `supabase/migrations/20260915010000_seed_demo.sql`
- [ ] 新建 query 跑下面自检语句，确认数字：

```sql
select
  (select count(*) from public.shops) as 店铺,       -- 应为 9
  (select count(*) from public.categories) as 分类,  -- 应为 26
  (select count(*) from public.dishes) as 菜品,       -- 应为 62
  (select count(*) from public.coupons) as 券,        -- 应为 6
  (select count(*) from auth.users) as 演示账号;       -- 应为 3
```

> **重复执行**：init 脚本里的枚举类型已做存在性判断，重跑不会因残留类型报错。
> 若仍提示表已存在（说明上次执行到中途），在 SQL Editor 里跑一次下面的清理再重跑两个文件：
> ```sql
> drop schema public cascade;
> create schema public;
> grant usage on schema public to anon, authenticated, service_role;
> ```

## ③ 关闭邮箱验证（约 1 分钟）

- [ ] 左侧 **Authentication** → **Sign In / Providers** → **Email**
  - 保持 **Enable Email provider** 开启
  - 把 **Confirm email（确认邮件）关掉** → **Save**
- 官方文档原文：默认情况下用户必须先验证邮箱才能登录，关掉 `Confirm email` 才能让演示账号直接登录。
- 说明：项目里的「手机验证码 123456」是前端演示 Mock，不接收费短信，这里不需要任何短信配置。

## ④ 确认存储桶与实时通道（约 1 分钟，SQL 已自动配好，只需确认）

- [ ] 左侧 **Storage**：应看到 `avatars`、`dish-images`、`review-images` 三个桶，都是 public
- [ ] **Database** → **Publications** → `supabase_realtime`：应能看到 orders、messages、notifications、refund_requests、delivery_exceptions 已在列表里（SQL 已加，不用手点）

## ④b 第 3 期补丁：把会话表加进实时通道（约 1 分钟）

代码已支持"跨设备不用刷新"。订单与消息的推送开箱可用，只剩一张表需要补：

- [ ] **SQL Editor** → **New query**，粘贴执行 `supabase/migrations/20260927000000_realtime_conversations.sql`
- [ ] 执行完应看到四行，都是 `in_realtime_pub = true`：

```sql
-- 脚本末尾自带这条自检，也可以单独再跑一次
select t.name as table_name,
       (p.tablename is not null) as in_realtime_pub
  from (values ('orders'), ('order_items'), ('messages'), ('conversations')) as t(name)
  left join pg_publication_tables p
         on p.pubname = 'supabase_realtime'
        and p.schemaname = 'public'
        and p.tablename = t.name
 order by t.name;
```

- 为什么需要它：建表脚本把 orders、order_items、messages 加进了实时通道，**漏掉了 conversations**。
  不在通道里的表，变更事件根本不会发出——表现为对方把会话标记已读、或新建会话时这边不刷新。
- 可以重复执行，不会报错。
- 想自己验证"推送到底通不通"：在项目目录里跑 `node scripts/verify-realtime.mjs`（详见脚本头部说明）。

## ⑤ 拿两个连接参数发我（约 1 分钟）

- [ ] 左侧 **Project Settings**（齿轮）→ **API**（新版可能叫 **API Keys**），或直接点项目顶部的 **Connect** 面板
- [ ] 复制这两个值：
  - **Project URL**（形如 `https://xxxxxxxx.supabase.co`）
  - **Publishable key**（`sb_publishable_...`）或旧版的 **`anon` `public`** 那一长串

> 安全说明：publishable / anon key 设计上就是给前端公开的（打包后任何人都能在浏览器里看到，这是正常的），数据安全全部由 SQL 里的 56 条 RLS 策略保证。
> **`secret` / `service_role` 开头的密钥绝对不要发我、更不能写进前端**，它能绕过所有权限。

## ⑥ 我拿到参数后的分工

1. 在本地工程安装 `@supabase/supabase-js`，新建 client 读环境变量 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，把 `useAuth` 的模拟登录换成**真实邮箱密码认证**（短信验证码继续保留前端 Mock `123456`，并注明真实短信接入点），三端账号角色与 `profiles` 表对齐；
2. 之后按设计稿推进：店铺菜品上云 → 订单三端联动 → IM/评价 → 资金收尾；
3. 每期改完照旧：类型检查 0 错误 + 构建通过 → commit → push → Cloudflare 自动重新部署。

> ⚠️ 部署前记得在 Cloudflare 的 **Settings → Environment variables** 里补上
> `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`，否则线上版本连不上数据库。

## ⑦ 演示账号（跑完 seed 后即可使用）

| 端 | 登录手机号 | 密码 |
|---|---|---|
| 顾客端 | `13800000001` | `123456` |
| 商家端 | `13800000002` | `123456` |
| 骑手端 | `13800000003` | `123456` |

登录页填**手机号**即可；程序内部会把它映射成合成邮箱去调 Supabase 认证，所以**不需要真实邮箱、也不会发任何邮件**。

> 实现细节：合成邮箱的实际格式是 **`phone{手机号}@jianwei.app`**——Supabase 会拒绝「本地部分纯数字」的邮箱
> （实测 `13900000099@jianwei.app` 报 `email_address_invalid`），所以必须带 `phone` 前缀。

> ⚠️ 跑完 seed 后请确认 **Authentication → Sign In / Providers → Email → `Confirm email` 是关闭的**。
> 它开着时，新注册用户必须先点邮件里的确认链接才能登录，而演示环境用的是合成邮箱、收不到信。

## 常见疑问

- **免费额度**：以 Supabase 官网实时显示为准；免费项目长期不访问会休眠，再访问自动唤醒、**数据不丢**。
- **SQL 跑错了想重来**：SQL Editor 里跑 `drop schema public cascade; create schema public;` 再按顺序重跑两个文件即可（演示数据随便重建）。
- **RLS 行级安全不要关**：Table 编辑器里每张表都带着 RLS，这是安全边界，不是报错。

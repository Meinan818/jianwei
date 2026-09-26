# Supabase 控制台操作清单（约 10 分钟，照着打勾）

> 目标：建好云端数据库，跑完两个 SQL，拿到两个连接参数发我，然后我回妙搭做第 1 期（登录）改造。
> 全程免费；用电脑浏览器操作最方便（手机也能做，但复制 SQL 不方便）。

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
- [ ] 打开文件 `20260915000000_init_schema.sql`，全文复制粘贴进去 → **Run**
  - 成功标志：底部显示 `Success. No rows returned`，没有红色报错
- [ ] 再 **New query**，打开 `20260915010000_seed_demo.sql` 全文粘贴 → **Run**
- [ ] 新建 query 跑下面自检语句，确认数字：

```sql
select
  (select count(*) from public.shops) as 店铺,       -- 应为 9
  (select count(*) from public.categories) as 分类,  -- 应为 26
  (select count(*) from public.dishes) as 菜品,       -- 应为 62
  (select count(*) from public.coupons) as 券,        -- 应为 6
  (select count(*) from auth.users) as 演示账号;       -- 应为 3
```

## ③ 登录认证设置（约 1 分钟）

- [ ] 左侧 **Authentication** → **Sign In / Providers**（或 Providers）→ **Email**
  - 保持 **Enable Email provider** 开启
  - 把 **Confirm email（邮箱验证）关掉**（演示项目免验证、注册即登录；作品集演示更顺，以后想加验证随时能开）
  - Save
- 说明：App 里的「手机验证码 123456」是前端演示 Mock，不接收费短信，这里不需要任何短信配置。

## ④ 检查存储桶与实时通道（约 1 分钟，SQL 已自动配好，只需确认）

- [ ] 左侧 **Storage**：应看到 `avatars`、`dish-images`、`review-images` 三个桶，都是 public
- [ ] **Database** → **Publications** → `supabase_realtime`：应能看到 orders、messages、notifications、refund_requests、delivery_exceptions 已在列表里（SQL 已加，不用手点）

## ⑤ 拿两个连接参数发我（约 1 分钟）

- [ ] 左侧 **Project Settings**（齿轮）→ **API**，找到并复制：
  - **Project URL**（形如 `https://xxxxxxxx.supabase.co`）
  - **Project API keys → `anon` `public`** 那一长串（不是 service_role！）
- [ ] 把这两个值直接发给我

> 安全说明：anon key 设计上就是给前端公开的（打包后任何人都能在浏览器里看到，这是正常的），数据安全全部由 SQL 里的 56 条 RLS 策略保证。
> **`service_role` / `secret` 开头的密钥绝对不要发我、更不能写进前端**，它能绕过所有权限。

## ⑥ 我拿到参数后的分工

1. 我在妙搭工程里装 supabase-js、写 client 初始化，做**第 1 期：真实登录注册**（邮箱密码真实、演示码 123456 保留为 Mock、三端账号独立），改完发新版并按老规矩留存 commit 基线 + 台账；
2. 之后按设计稿的 6 期推进：店铺菜品上云 → 订单三端联动 → IM/评价 → 资金收尾；
3. 每期你都能在演示 App 里用三个演示账号体验（密码均为 `123456`）：
   - 演示顾客 `demo-customer@jianwei.app`
   - 演示商家 `demo-merchant@jianwei.app`（自带「演示小店」）
   - 演示骑手 `demo-rider@jianwei.app`

## 常见疑问

- **免费额度**：以 Supabase 官网实时显示为准；免费项目长期不访问会休眠，再访问自动唤醒、**数据不丢**。
- **SQL 跑错了想重来**：SQL Editor 里跑 `drop schema public cascade; create schema public;` 再按顺序重跑两个文件即可（演示数据随便重建）。
- **RLS 行级安全不要关**：Table 编辑器里每张表都带着 RLS，这是安全边界，不是报错。

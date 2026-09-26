# 项目技术规范

## 技术栈

- 前端: React 19 + TypeScript
- 样式: Tailwind CSS v4
- UI 组件: shadcn/ui `import { Button } from "@/components/ui/button";`
- 图标: lucide-react `import { SearchIcon } from "lucide-react";`
- 图表: echarts-for-react `import ReactECharts from "echarts-for-react";`
- 动画: framer-motion `import { motion } from "framer-motion";`
- 路由: react-router-dom `import { Link, useNavigate } from "react-router-dom";`

---

## 目录结构

```
src/
├── index.tsx            # 入口（勿修改）
├── app.tsx              # 路由配置（仅在 <Routes> 内增删 <Route>）
├── index.css            # 全局样式 + 主题变量
├── components/          # 基础 UI 组件（禁止存放业务组件）
│   ├── layout.tsx       # 全局布局容器（含 <Outlet />）
│   └── ui/              # shadcn/ui 内置组件（勿修改）
├── pages/               # 页面模块（每个页面一个目录）
│   ├── <PageName>/      # 页面目录示例
│   │   ├── PageName.tsx        # 页面入口文件与目录同名
│   │   └── components/         # 页面专属组件
│   └── NotFoundPage/
│       └── NotFoundPage.tsx
├── hooks/               # 自定义 Hooks
└── lib/                 # 工具函数（cn() 等）

shared/
└── static/              # 静态资源
    ├── data/            # 数据文件（JSON）
    └── images/          # 图片资源
```

---

## 本地运行与构建

> 仓库里的 `scripts/dev.mjs`、`scripts/build.sh`、`.spark/`、`shared/` 是原托管平台的包装文件，
> 会注入 `/app/<平台应用id>` 路径前缀与 CDN 变量，**平台外不要使用**。请直接用 Vite 原生命令。

```bash
npm install
npx vite                        # 本地开发，默认 http://localhost:5173
npx tsc -p tsconfig.app.json    # 类型检查，必须 0 错误
npm run build:standalone        # 平台外独立构建，产物在 dist/client/
```

`npm run build:standalone` 用于部署 Cloudflare Pages 或本地离线演示：它会以
`MIAODA_BUILD_TARGET=standalone` 调用 Vite，摘掉平台注入的 `{{appName}}` 占位符、外链统计脚本与妙搭水印，
并把 `BrowserRouter` 换成 `HashRouter`（刷新子路径不 404）。直接用 `npx vite build` 得到的是平台托管产物，
**不适合对外部署**，细节见 `scripts/build-standalone.mjs` 头部注释。

## 项目现状（v60）

- 三端严格独立：根路径是启动选择器，顾客端 `/customer/*`、商家端 `/merchant/*`、骑手端 `/rider/*` 各自独立账号池与导航，端内不跨端跳转。
- 订单 9 态状态机、消息/通知中心、钱包会员、优惠券、评价等业务数据当前全部存在浏览器 localStorage（经平台 `scopedStorage` 封装），尚未接后端。
- 支付与短信验证码为前端 Mock（演示码固定 `123456`），代码中保留真实接入点注释。

完整的项目定位、硬性约束、Supabase 迁移分期与部署步骤见 `AGENTS.md`（该文件为唯一权威交接说明，与本文冲突时以其为准）。

---

## 禁止修改的文件

| 文件 | 原因 |
|------|------|
| `src/index.tsx` | Provider 层级 + 样式引入，由模板管理 |
| `src/components/ui/*` | shadcn/ui 内置组件，版本锁定 |

---

## 文件放置规则

| 内容类型 | 放置位置 |
|---------|---------|
| 新页面 | `src/pages/<PageName>/PageName.tsx` |
| 页面专属组件 | `src/pages/<PageName>/components/` |
| 自定义 Hooks | `src/hooks/` |
| 工具函数 | `src/lib/` |
| 静态数据文件 | `shared/static/data/` |
| 静态图片 | `shared/static/images/` |

---

## 导入路径

```typescript
// @/ 别名 → src/
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// @shared/ 别名 → shared/
import heroImage from "@shared/static/images/hero.png";
import configData from "@shared/static/config.json";
```

---

## 路由配置

- 新增页面需在 `src/app.tsx` 的 `<Routes>` 内注册 `<Route>`
- `BrowserRouter` 已在 `index.tsx` 中配置，`app.tsx` 中**禁止**再包裹 Router

---

## 主题变量

主题色定义在 `src/tailwind-theme.css`（由 `src/index.css` 引入），通过 `:root` CSS 变量 + `@theme inline` 注册到 Tailwind。

| 用途 | Tailwind 类 | CSS 变量 |
|------|------------|----------|
| 页面背景 | `bg-background` | `--background` |
| 主文本 | `text-foreground` | `--foreground` |
| 卡片背景 | `bg-card` | `--card` |
| 次要文本 | `text-muted-foreground` | `--muted-foreground` |
| 主色 | `bg-primary` / `text-primary` | `--primary` |
| 强调色 | `bg-accent` | `--accent` |
| 边框 | `border-border` | `--border` |
| 危险色 | `text-destructive` | `--destructive` |
| 图表色 | `bg-chart-1` ~ `bg-chart-5` | `--chart-1` ~ `--chart-5` |

HSL 格式使用**空格分隔**：`--primary: hsl(150 60% 40%);`

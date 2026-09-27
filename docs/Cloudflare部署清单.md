# Cloudflare Pages 部署清单（照着打勾即可）

> 目标：把当前前端版本发布成一个可公网访问的 https 链接，之后每次 `git push` 自动重新部署。
> 整个流程零成本，不接真实支付/短信，不需要买域名（先用 Cloudflare 送的 `*.pages.dev` 子域名）。

## 关键配置速查（照着填，别用默认值）

| 配置项 | 正确值 | 说明 |
|---|---|---|
| Framework preset | `Vite`（或 `None`） | 选完**必须手动改下面两项**，预设填的默认值是错的 |
| Build command | `npm run build:standalone` | ⚠️ **不要用** `npm run build`（那是原平台包装脚本，会注入 `/app/<应用id>` 前缀） |
| Build output directory | `dist/client` | ⚠️ 不是 `dist`，平台预设的产物目录自带 `client` 子层 |
| Node 版本 | 由仓库根目录 `.nvmrc` 指定（22.16.0） | 无需额外配置；Vite 8 要求 Node ≥ 22.12 |
| 环境变量 | 暂不配置 | 接入 Supabase 后再加 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |

## ① 代码推到 GitHub（约 3 分钟）

- [ ] 打开 https://github.com/new 新建仓库
  - Repository name：`jianwei-codex`（随意，与本地文件夹同名）
  - **不要勾选** Add a README / .gitignore / license（勾了会产生冲突，本地已有完整历史）
  - 公开或私有都可以，Cloudflare Pages 两种都能连；作品集建议 Public
- [ ] 建好后把仓库地址（形如 `https://github.com/Meinan818/jianwei-codex.git`）发给 AI，由它执行 `git remote add` + `git push`
  - 本机已装 Git Credential Manager，推送时会**自动弹出浏览器**让你登录 GitHub 授权，按提示点完即可

## ② 连接 Cloudflare Pages（约 3 分钟）

- [ ] 打开 https://dash.cloudflare.com → 注册或登录（免费账号即可）
- [ ] 左侧 **Workers & Pages** → **Create** → 切到 **Pages** 标签 → **Connect to Git**
- [ ] 授权 Cloudflare 访问 GitHub，选择刚推送的 `jianwei-codex` 仓库 → Begin setup
- [ ] **Build settings** 里按下表填写：
  - [ ] Framework preset：`Vite`（或 `None`，无所谓，下面两项会覆盖它）
  - [ ] Build command：`npm run build:standalone`
  - [ ] Build output directory：`dist/client`
  - [ ] Production branch：`main`
  - [ ] 其余保持默认，环境变量留空
- [ ] 点 **Save and Deploy**，等 1–3 分钟

## ③ 验收（必须逐条点过，别只看首页能打开）

- [ ] 拿到 `https://<项目名>.pages.dev` 链接，浏览器能打开
- [ ] 标题正确显示「简味点单」（不是 `{{appName}}`，也不是「应用标题」）
- [ ] 右下角**没有**妙搭水印气泡
- [ ] 启动页三张卡片（顾客端 / 商家端 / 骑手端）都能进入
- [ ] 走通一条完整链路：顾客下单 → 收银台支付（演示码 `123456`）→ 回启动页切商家端接单出餐 → 切骑手端抢单取餐送达 → 切回顾客端评价
- [ ] 在某个子页面**按 F5 刷新**，不会出现 404
- [ ] 在手机浏览器上打开同一链接，竖屏显示正常（产品形态是移动端竖屏网页）

## ④ 之后每次更新的节奏

- [ ] 每次改完代码：`npx tsc -p tsconfig.app.json` 0 错误 → `npm run build:standalone` 通过 → `git commit`
- [ ] `git push` 后 Cloudflare 自动重新构建部署，无需再进控制台
- [ ] 接完 Supabase 那几期，记得在 Cloudflare 的 **Settings → Environment variables** 里补上
  `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`（**anon** key，绝不要填 service_role），然后重新部署一次

## 已知注意点

- **数据现状**：部署的这版业务数据存在浏览器 localStorage 里，所以「同一台设备、同一个浏览器」可以完整演示三端走单；
  换设备或换浏览器看不到对方下的单。接完 Supabase 后才是真正的跨设备共享。这是分两阶段发布的正常状态。
- **仓库里的 `.npmrc`** 指向 `registry.npmmirror.com`（国内加速源）。若 Cloudflare 构建在此源上拉包超时，
  把该文件改成官方源 `https://registry.npmjs.org/` 再推一次即可。
- **`npm run build` 是陷阱**：它是原托管平台的包装脚本，产出的是平台托管产物（含 `{{appName}}` 占位符、外链统计脚本、妙搭水印），
  对外部署必须用 `npm run build:standalone`，细节见 `scripts/build-standalone.mjs` 头部注释。
- 免费额度与休眠策略以 Cloudflare 官网实时说明为准。

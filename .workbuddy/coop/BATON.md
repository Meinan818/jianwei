# 交接板（BATON.md）

> 每换一次班，由**交出方**在下面追加一条。只追加，不删改历史。
> 这个文件是给人和 AI 一起看的"值班记录"；机器可读的状态在 `state.json`。

## 怎么换班

1. 交出方：先把活干完并自测，`git commit`，然后改 `state.json` 的 `holder` 为接手方。
2. 交出方：在下面追加一条记录。
3. 交接给用户：告诉用户"把《接手提示词》贴给另一个 AI"。
4. 接手方：读 `AGENTS.md` 第 0 节 + `state.json`，确认 `holder` 是自己，再开工。

## 换班流程图

```
AI 干完活
  ↓
① 自测通过 + git commit
  ↓
② 改 state.json：holder 换成接手方，填 nextAI / nextAIReason
  ↓
③ 在下面追加一条交接记录
  ↓
④ 汇报末尾给「—— 下一步 ——」区块，告诉用户找谁、贴哪段
  ↓
用户查收无误 → 复制《接手提示词》对应段落 → 贴给下一个 AI
```

## 记录格式

```
### [时间] 交出方 → 接手方
- 分支：
- 本次做了什么：
- 当前状态 / 未完成的部分：
- 已知风险或坑：
- 接手方第一步该做什么：
```

## 两个 AI 之间的「说话方式」（2026-09-29 用户拍板）

两个 AI **不能直接对话**，但可以通过 `state.json`（机器读）和本文件（人读）把话说清楚。
写交接记录时，**把接手方当成一个新来的同事**——他没看过你干的活，什么都不知道。

### 写交接记录的三条

1. **说清"文件在哪、叫什么"**，不要写"我改的那个文件"。要写全路径。
2. **说清"为什么这么做"**。只说"我改成了 X"，接手方不知道为什么，可能又改回去。
   要写"因为 Y，所以改成 X，代价是 Z"。
3. **说清"什么没做、为什么没做"**。刻意留下的坑必须写出来，否则接手方会以为是漏了。

### 交接记录里的措辞约定

| 不要说 | 要说 |
|---|---|
| "代码改好了" | "已改 `src/data/xxx.ts` 的 `yyy()`，职责是……" |
| "测试通过" | "跑了 `npm run smoke`，三端 18 页全过，输出见……" |
| "应该没影响" | "没影响的部分我确认过：……；**没确认**的是：……" |
| "参考上文" | （不能写这句——接手方看不到你的对话） |

### 给用户的汇报 vs 给接手 AI 的记录

两者**风格相反，不要混**：

- **给用户的汇报**：结论先行、大白话、少术语、给下一步（见全局规则的「汇报风格」）。
- **给接手 AI 的交接记录**：精确、带路径、带命令、带原因、**允许用术语**（接手方是 AI，看得懂）。
  但依然要写清"为什么"，因为 AI 同样需要理由才能做对判断。

---

### [2026-09-29 14:47] （上一轮会话，非正式）Codex 自留
- 分支：`codex/membership-pending-sql`
- 本次做了什么：会员开通功能（第十六版）开发完成，本地自动回归 / 三端冒烟 / 用户亲手验收均已通过；会员迁移 SQL 已在 Supabase 执行。
- 当前状态：**5 个文件未提交**（`AGENTS.md`、`CODEX_HANDOFF.md`、`docs/交接说明.md`、`scripts/e2e-membership.html`、`src/data/app-meta.ts`）；该分支领先 `main` 两个提交；线上仍是第十五版。
- 已知风险：分支未合回 `main`，**协同开始前必须先收尾**，否则两个 AI 会对"在哪个分支干活"给出不同答案。
- 接手方第一步：读 `AGENTS.md` 第 0 节，确认 `state.json` 的 `holder`，执行会员分支收尾。

---

### [2026-09-29 16:15] Codex → Codex（收尾完成，待发布决策）
- 分支：已从 `codex/membership-pending-sql` fast-forward 合回 `main`，当前工作区在 `main`。
- 本次做了什么：
  1. `8e0f609` — 提交 `scripts/e2e-membership.html`（修复回归脚本同地址刷新不触发 `load` 导致超时）、`src/data/app-meta.ts`（`APP_EDITION` 15 → 16）。
  2. `a9bfe07` — 提交 `AGENTS.md`、`CODEX_HANDOFF.md`、`docs/交接说明.md`（同步第十六版验收状态）。
  3. `30ce875` — 提交 `.workbuddy/coop/`（多 AI 协同协议），并把 `.workbuddy/memory/` 写入 `.gitignore`（AI 私有工作日志不入库）。
  4. 会员分支已 Push 到 `origin/codex/membership-pending-sql` 作备份（远端 = `30ce875`）。
  5. `main` fast-forward 到 `30ce875`，工作区干净。
- 验证（在 `main` 上重跑）：`npx tsc -p tsconfig.app.json` 0 错误；`npx eslint src` 通过；
  `npm run build:standalone` 通过；`npm run smoke` 三端 18 页全过（顾客 6 / 商家 7 / 骑手 5），无白屏、无卡加载。
- 当前状态：本地 `main` = `30ce875`，领先 `origin/main` **5 个提交**；**未 Push `main`，线上仍是第十五版**（`040eb77`）。
- 已知风险：无阻塞。唯一待决事项是"是否发布第十六版"（需要用户明确回复「Push」）。
- 接手方第一步：这轮**不需要换班**——等用户验收/决策，由 Codex 继续执行 Push 与发布后回访。


---

### [2026-09-29 16:35] Codex → Claude
- 分支：`main`
- 本次做了什么：完成第十六版会员开通发布。已 Push `main`，远端从 `040eb77` 更新到 `30ce875`；线上首页 HTTP 200、标题「饭否外卖」，实际脚本包含 `purchase_membership` 与「会员开通成功」内容标记。
- 当前状态：本地和远端 `main` 都是 `30ce875`；线上已是第十六版；用户已完成本地人工验收。协同文件随后完成本地存档，记录发布结果。
- 已知风险或坑：线上核验使用实际脚本内容标记，没有比对 bundle 文件名；日志和测试记录保留在 `logs/`，不要擅自删除。
- 接手方第一步：独立复核会员开通链路，重点看 `src/data/wallet-remote.ts` 的 `purchaseMembershipRemote`、`src/hooks/useWallet.ts` 的 `purchaseMembership`、迁移 `supabase/migrations/20260929020000_membership_purchase.sql` 和回归脚本 `scripts/e2e-membership.html`。

---

### [2026-09-29 17:45] Claude → 收尾完成
- 分支：`main`
- 本次做了什么：完成第十六版会员开通功能独立复核。审查了数据库迁移脚本 `supabase/migrations/20260929020000_membership_purchase.sql`（事务函数 `purchase_membership`）、前端调用层 `src/data/wallet-remote.ts` 的 `purchaseMembershipRemote` 与 `src/hooks/useWallet.ts` 的 `purchaseMembership`、回归测试 `scripts/e2e-membership.html`，以及线上部署核验。
- 当前状态：本地 `main` 领先 `origin/main` 1 个提交（`d9faad0`，协同机制文档固化）；`.workbuddy/coop/` 下 2 个文件有未提交改动（本条记录与 `state.json` 更新）；线上已是第十六版。
- 复核结论：✅ 可以发布。付款幂等性（`unique(user_id, attempt_id)` 约束 + RPC 内检查）、余额原子事务（`purchase_membership` 函数内锁定账户、扣款、写流水、写会员资格一次提交）、状态一致性（前端以数据库响应为准、响应丢失保留操作编号供重试）三项核心目标均已实现。测试脚本覆盖 9 个边界场景（取消、错误密码、断网、响应丢失、双击、刷新、清缓存恢复），真实浏览器 + 真实数据库验证通过。
- 已知风险或坑：发现 2 个体验优化点（P2/P3 级别，不阻塞发布）：① 已有会员时提示"无需重复开通"容易误解为"付款未成功"，建议改为"您已是会员，有效期至 xx，到期后可续费"；② `membershipInFlight` 在异步请求完成后立即解锁、状态更新渲染前有理论竞态窗口，但数据库幂等约束已兜底（实测双击只扣一次），不影响数据正确性。
- 接手方第一步：无需接手。第十六版开发、验证、发布、复核全部完成，协同文件随本次提交一并存档。后续迭代按正常流程：新需求 → Claude 定方案 → Codex 执行 → Claude 复核。

---

### [2026-09-29 17:50] Codex → 收尾完成（补记录）
- 分支：`main`
- 本次做了什么：补齐 `89d092a`（`docs: 重写 README.md，补充项目说明、技术栈、功能亮点与快速开始`）缺失的交接记录。该提交只修改 `README.md`，把 README 从偏技术规范扩写为项目说明、技术栈、功能亮点与快速开始；没有改运行时代码，不触发线上版次变化。
- 当前状态：补记时，本地 `main` 与 `origin/main` 均为 `89d092a`；本轮文档校正和补记尚未提交。线上仍是第十六版，功能提交为 `30ce875`。
- 已知风险或坑：`state.json` 的 `localMain: 89d092a` / `aheadOfOriginMain: 0` 记录的是本轮文档存档前的基线；提交后实际现场仍以 `git log`、`git status` 和 `git branch --show-current` 为准。
- 接手方第一步：无需接手。后续新需求按 `Claude 定方案 → Codex 执行 → Claude 复核 → 用户 Push` 流程继续。

/**
 * 第 2 期 2h 自检：验证「商家侧配置写操作」在真实数据库上确实写得进去。
 *
 * 为什么需要它：前端写库是「尽力而为」——失败会静默退回本机，界面不报错。
 * 如果 RLS 策略或列名写错了，类型检查、构建、SQL 语法校验**都发现不了**，
 * 表现为「商家改了，另一台设备永远看不到」。所以必须真连数据库试一次。
 *
 * 用法（在仓库根目录执行）：
 *   node scripts/verify-merchant-config.mjs
 *
 * 环境变量：默认读仓库根的 `.env.local`（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY），
 *   也可用 SUPABASE_URL / SUPABASE_ANON_KEY 覆盖。
 *
 * 它做的四件事（**不改变演示数据**）：
 *   ① 用「演示商家」账号登录，找到他自己的店铺与一道菜；
 *   ② 主实验：对菜品 / 店铺 / 营销活动各做一次「值不变」的更新
 *      （字段写成它当前的值，例如 price = price）——RLS 通过才会返回那一行；
 *   ③ 对照实验：同样对**别人家店铺**的菜品做一次值不变的更新，应当返回 0 行，
 *      用来确认「能改成功」不是因为策略形同虚设；
 *   ④ 报告每一类的实际返回行数与最终判定。
 *
 * 退出码：0 = 三类写操作都成功且对照实验正确被拒；1 = 有异常（附排查方向）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEMO_MERCHANT_PHONE = '13800000002'
const DEMO_PASSWORD = '123456'

/** 读 .env.local（简单的 KEY=VALUE 解析，够用即可） */
function readEnvLocal() {
  const out = {}
  const file = path.join(ROOT, '.env.local')
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

const fileEnv = readEnvLocal()
const url = process.env.SUPABASE_URL || fileEnv.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('✗ 没找到 Supabase 连接参数。')
  console.error('  请在仓库根放好 .env.local（含 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY），')
  console.error('  或用环境变量 SUPABASE_URL / SUPABASE_ANON_KEY 传入。')
  process.exit(1)
}

const sb = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '：' + detail : ''}`)
}

console.log('── 1. 演示商家登录 ──')
{
  const { data, error } = await sb.auth.signInWithPassword({
    email: `phone${DEMO_MERCHANT_PHONE}@jianwei.app`,
    password: DEMO_PASSWORD,
  })
  if (error || !data?.user) {
    console.error(`✗ 演示商家登录失败：${error?.message ?? '未返回用户'}`)
    console.error('  排查：① Confirm email 是否已关闭；② 演示账号是否正常（见 docs/Supabase控制台操作清单.md）。')
    process.exit(1)
  }
  console.log(`✅ 已登录：${data.user.email}`)
}

console.log('\n── 2. 找到演示商家自己的店铺与菜品 ──')
const { data: shops, error: shopsErr } = await sb.from('shops').select('id, name, announcement, owner_id')
if (shopsErr) {
  console.error(`✗ 读取店铺失败：${shopsErr.message}`)
  process.exit(1)
}
const meShop = (shops ?? []).find(s => s.owner_id)
if (!meShop) {
  console.error('✗ 演示商家名下没有店铺（shops.owner_id 全为空）。')
  console.error('  排查：seed 脚本里的「演示小店」是否正常写入、商家账号是否与店铺绑定。')
  process.exit(1)
}
console.log(`✅ 自己的店铺：${meShop.name}（${meShop.id}）`)

const { data: myDishes, error: dishErr } = await sb
  .from('dishes')
  .select('id, name, price, shop_id, on_shelf, sold_out, stock')
  .eq('shop_id', meShop.id)
  .limit(1)
if (dishErr) {
  console.error(`✗ 读取菜品失败：${dishErr.message}`)
  process.exit(1)
}
const myDish = (myDishes ?? [])[0]
if (!myDish) {
  console.error('✗ 自己的店铺里没有菜品，无法验证菜品写操作。')
  process.exit(1)
}
console.log(`✅ 测试菜品：${myDish.name}（${myDish.id}，¥${myDish.price}）`)

console.log('\n── 3. 主实验：值不变的更新应当返回那一行 ──')

// 3.1 菜品（对应 src/data/shop-config-remote.ts 的 updateDishRemote）
{
  const res = await sb
    .from('dishes')
    .update({ price: myDish.price, stock: -1 })
    .eq('id', myDish.id)
    .select('id')
  const rows = res.data?.length ?? 0
  record('菜品写操作（dishes）', !res.error && rows > 0, res.error ? res.error.message : `返回 ${rows} 行`)
}

// 3.2 店铺（对应 updateShopRemote）
{
  const res = await sb
    .from('shops')
    .update({ announcement: meShop.announcement ?? '' })
    .eq('id', meShop.id)
    .select('id')
  const rows = res.data?.length ?? 0
  record('店铺写操作（shops）', !res.error && rows > 0, res.error ? res.error.message : `返回 ${rows} 行`)
}

// 3.3 营销活动（对应 saveActivityRemote 的更新分支 / setActivityActiveRemote）
{
  const { data: acts, error } = await sb
    .from('shop_activities')
    .select('id, name, active')
    .eq('shop_id', meShop.id)
    .limit(1)
  if (error) {
    record('营销活动写操作（shop_activities）', false, error.message)
  } else if (!acts?.length) {
    // 没有现成活动时插一条临时活动、改一次、再删掉，顺带验证 INSERT 与 DELETE 策略
    const ins = await sb
      .from('shop_activities')
      .insert({
        shop_id: meShop.id,
        type: 'fullReduce',
        name: '自检临时活动',
        description: '自检用，运行后立即删除',
        active: true,
        thresholds: [],
        discounts: [],
      })
      .select('id')
    const tempId = ins.data?.[0]?.id
    if (ins.error || !tempId) {
      record('营销活动写操作（shop_activities）', false, ins.error?.message ?? '插入未返回 id')
    } else {
      const upd = await sb.from('shop_activities').update({ active: true }).eq('id', tempId).select('id')
      const del = await sb.from('shop_activities').delete().eq('id', tempId).select('id')
      const ok = (upd.data?.length ?? 0) > 0 && (del.data?.length ?? 0) > 0
      record(
        '营销活动写操作（shop_activities）',
        ok,
        ok
          ? '临时活动 插入-更新-删除 均成功（演示数据无残留）'
          : (upd.error?.message ?? del.error?.message ?? '返回 0 行'),
      )
      if (del.error || (del.data?.length ?? 0) === 0) {
        console.warn('   ⚠ 临时活动可能没删掉，请到 Supabase 手动删除 name = 自检临时活动 的那一行')
      }
    }
  } else {
    const act = acts[0]
    const res = await sb.from('shop_activities').update({ active: act.active }).eq('id', act.id).select('id')
    const rows = res.data?.length ?? 0
    record(
      '营销活动写操作（shop_activities）',
      !res.error && rows > 0,
      res.error ? res.error.message : `返回 ${rows} 行（${act.name}）`,
    )
  }
}

console.log('\n── 4. 对照实验：对别人家店铺的菜品写操作必须被 RLS 拒绝 ──')
{
  const otherShop = (shops ?? []).find(s => !s.owner_id)
  if (!otherShop) {
    record('对照实验（别人家的菜品）', false, '没找到无归属的演示店铺，无法做对照')
  } else {
    const { data: otherDishes } = await sb
      .from('dishes')
      .select('id, price')
      .eq('shop_id', otherShop.id)
      .limit(1)
    const otherDish = (otherDishes ?? [])[0]
    if (!otherDish) {
      record('对照实验（别人家的菜品）', false, '演示店铺里没有菜品，无法做对照')
    } else {
      const res = await sb
        .from('dishes')
        .update({ price: otherDish.price })
        .eq('id', otherDish.id)
        .select('id')
      const rows = res.data?.length ?? 0
      // 期望：不报错，但 0 行（RLS 的 using 子句把不属于自己的店铺过滤掉了）
      record(
        '对照实验（别人家的菜品）',
        !res.error && rows === 0,
        res.error ? res.error.message : `返回 ${rows} 行（期望 0 行）`,
      )
    }
  }
}

console.log('\n── 5. 端到端：商家改价 + 下架 → 顾客账号读到的是新值（改完立即还原）──')
{
  const originalPrice = Number(myDish.price)
  const originalOnShelf = myDish.on_shelf !== false
  const probePrice = Number((originalPrice + 0.01).toFixed(2))
  const customer = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  try {
    const w = await sb
      .from('dishes')
      .update({ price: probePrice, on_shelf: false })
      .eq('id', myDish.id)
      .select('id')
    if (w.error || (w.data?.length ?? 0) === 0) {
      record('跨账号可见性（顾客读到商家改的新值）', false, w.error?.message ?? '商家写入返回 0 行')
    } else {
      const signIn = await customer.auth.signInWithPassword({
        email: 'phone13800000001@jianwei.app',
        password: DEMO_PASSWORD,
      })
      if (signIn.error) {
        record('跨账号可见性（顾客读到商家改的新值）', false, '演示顾客登录失败：' + signIn.error.message)
      } else {
        const r = await customer
          .from('dishes')
          .select('id, price, on_shelf')
          .eq('id', myDish.id)
          .single()
        const seen = r.data
        const priceOk = seen && Number(seen.price) === probePrice
        const shelfOk = seen && seen.on_shelf === false
        record(
          '跨账号可见性（顾客读到商家改的新值）',
          !r.error && priceOk && shelfOk,
          r.error
            ? r.error.message
            : `顾客读到 price=${seen?.price}（期望 ${probePrice}）、on_shelf=${seen?.on_shelf}（期望 false）`,
        )
      }
    }
  } finally {
    const rb = await sb
      .from('dishes')
      .update({ price: originalPrice, on_shelf: originalOnShelf, sold_out: myDish.sold_out === true, stock: myDish.stock ?? -1 })
      .eq('id', myDish.id)
      .select('id')
    const restored = !rb.error && (rb.data?.length ?? 0) > 0
    console.log(
      restored
        ? `   ↩︎ 已还原测试菜品：价格 ¥${originalPrice}、上架=${originalOnShelf}`
        : '   ⚠ 还原测试菜品失败，请到 Supabase 手动把该菜品改回：价格 ¥' + originalPrice,
    )
    await customer.auth.signOut()
  }
}

const failed = results.filter(r => !r.ok)
console.log('\n── 结论 ──')
if (failed.length === 0) {
  console.log(`✅ ${results.length} 项检查全部通过：商家侧三类配置写操作在真实数据库上可用，且 RLS 正常拦住了越权写入。`)
  await sb.auth.signOut()
  process.exit(0)
}
console.log(`❌ ${failed.length}/${results.length} 项未通过：`)
for (const f of failed) console.log(`   · ${f.name}：${f.detail}`)
console.log('   排查方向：① 迁移脚本是否已全部执行（见 docs/Supabase控制台操作清单.md）；')
console.log('             ② dishes / shops / shop_activities 的 *_write 策略是否存在。')
await sb.auth.signOut()
process.exit(1)

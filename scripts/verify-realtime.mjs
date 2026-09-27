/**
 * 第 3 期自检：验证 Supabase Realtime 能不能把「顾客改单」推给商家端。
 *
 * 为什么需要它：实时推送最容易出「静默失败」——订阅显示成功、页面也不报错，
 * 但事件根本没送到对面。类型检查、构建、SQL 语法校验都发现不了，
 * 只能真连数据库、用两个账号试一次。
 *
 * 用法（在仓库根目录执行）：
 *   node scripts/verify-realtime.mjs
 *
 * 环境变量：默认读仓库根的 `.env.local`（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY），
 *   也可用 SUPABASE_URL / SUPABASE_ANON_KEY 覆盖。
 *
 * 它做的四件事（都不改变演示数据）：
 *   ① 同时用「演示顾客」和「演示商家」两个账号登录（两个独立客户端）；
 *   ② 找出两边都能看到的订单（就是演示里顾客下的那单）；
 *   ③ 对照实验：顾客插一条 notifications 再删掉——这张表读策略只看 user_id，
 *      事件一定能送；连它都收不到就说明通道本身坏了（页面不读这张表，插入不可见）；
 *   ④ 主实验：顾客对那笔订单做一次「值不变」的更新（remark = remark），
 *      触发一次真实的 UPDATE 事件，看**顾客端和商家端是否都收到**。
 *      （值不变 = 订单内容不变，演示数据不受影响。）
 *
 * 退出码：0 = 顾客端与商家端都收到推送；1 = 有一端没收到（附排查方向）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEMO_CUSTOMER_PHONE = '13800000001'
const DEMO_MERCHANT_PHONE = '13800000002'
const DEMO_PASSWORD = '123456'
const SUBSCRIBE_TIMEOUT_MS = 15_000
const CONTROL_WAIT_MS = 6_000
const ORDER_WAIT_MS = 10_000

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

const sleep = ms => new Promise(r => setTimeout(r, ms))
const makeClient = () =>
  createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

/** 登录并返回用户 id */
async function signIn(sb, phone, label) {
  const { data, error } = await sb.auth.signInWithPassword({
    email: `phone${phone}@jianwei.app`,
    password: DEMO_PASSWORD,
  })
  if (error || !data?.user) {
    console.error(`✗ ${label}登录失败：${error?.message ?? '未返回用户'}`)
    console.error('  排查：① Confirm email 是否已关闭；② 演示账号是否正常（见 docs/Supabase控制台操作清单.md）。')
    process.exit(1)
  }
  console.log(`✅ ${label}已登录：${data.user.email}`)
  return data.user.id
}

/** 订阅某客户端的 orders（可选再订 notifications），返回收到的标记对象 */
async function subscribeOrders(sb, channelName, label, watchNotifications) {
  const seen = { orders: 0, notificationInsert: false, lastOldKeys: '(还没收到)' }
  const channel = sb.channel(channelName)
  if (watchNotifications) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, payload => {
      if (payload.eventType === 'INSERT') seen.notificationInsert = true
      console.log(`   ← [${label}] notifications ${payload.eventType}`)
    })
  }
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
    seen.orders += 1
    // 诊断用：默认 replica identity 下 old 只带主键；设成 FULL 后 old 会带全部列
    seen.lastOldKeys = Object.keys(payload.old ?? {}).join(',') || '(空)'
    console.log(`   ← [${label}] orders ${payload.eventType}（old 字段：${seen.lastOldKeys}）`)
  })
  const status = await new Promise(resolve => {
    const timer = setTimeout(() => resolve('TIMEOUT'), SUBSCRIBE_TIMEOUT_MS)
    channel.subscribe(s => {
      if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
        clearTimeout(timer)
        resolve(s)
      }
    })
  })
  console.log(`${status === 'SUBSCRIBED' ? '✅' : '✗'} [${label}] 订阅状态：${status}`)
  return { channel, seen, ok: status === 'SUBSCRIBED' }
}

const customer = makeClient()
const merchant = makeClient()
const customerSub = { channel: null, seen: null }
const merchantSub = { channel: null, seen: null }
let notificationId = null
let exitCode = 1

try {
  console.log('── 1. 登录两个演示账号 ──')
  const customerId = await signIn(customer, DEMO_CUSTOMER_PHONE, '演示顾客')
  await signIn(merchant, DEMO_MERCHANT_PHONE, '演示商家')

  console.log('\n── 2. 找一笔「顾客与商家都能看到」的订单 ──')
  const { data: custOrders, error: custErr } = await customer
    .from('orders')
    .select('id,order_seq,status,remark,shop_name')
    .order('created_at', { ascending: false })
  if (custErr) {
    console.error(`✗ 顾客端读订单失败：${custErr.message}`)
    process.exit(1)
  }
  const { data: merchOrders, error: merchErr } = await merchant
    .from('orders')
    .select('id,order_seq')
  if (merchErr) {
    console.error(`✗ 商家端读订单失败：${merchErr.message}`)
    process.exit(1)
  }
  const merchIds = new Set((merchOrders ?? []).map(o => o.id))
  const shared = (custOrders ?? []).find(o => merchIds.has(o.id))
  if (!shared) {
    console.error('✗ 顾客与商家没有共同可见的订单，无法测跨端推送。')
    console.error('  请先用顾客端从「演示小店」下一单（走完支付），再回来重跑本脚本。')
    console.error(`  （顾客可见 ${custOrders?.length ?? 0} 单，商家可见 ${merchOrders?.length ?? 0} 单）`)
    process.exit(1)
  }
  console.log(`✅ 用订单 ${shared.order_seq ?? shared.id}（状态 ${shared.status}，店铺 ${shared.shop_name}）`)

  console.log('\n── 3. 两个客户端分别订阅 orders ──')
  const a = await subscribeOrders(customer, 'verify-realtime-customer', '顾客', true)
  const b = await subscribeOrders(merchant, 'verify-realtime-merchant', '商家', false)
  customerSub.channel = a.channel
  customerSub.seen = a.seen
  merchantSub.channel = b.channel
  merchantSub.seen = b.seen
  if (!a.ok || !b.ok) {
    console.error('✗ 订阅未建立。排查：网络/代理是否正常；Supabase 免费项目是否已休眠（打开控制台唤醒）。')
    process.exit(1)
  }

  console.log('\n── 4. 对照实验：顾客插一条通知（页面不读这张表，结束时删掉）──')
  const { data: inserted, error: insErr } = await customer
    .from('notifications')
    .insert({
      user_id: customerId,
      category: 'system',
      title: '实时推送自检（可删）',
      content: 'scripts/verify-realtime.mjs 的对照实验，脚本结束时会删除。',
    })
    .select('id')
    .maybeSingle()
  if (insErr) {
    console.error(`✗ 插入通知失败：${insErr.message}（不影响主实验，继续）`)
  } else {
    notificationId = inserted?.id ?? null
    const deadline = Date.now() + CONTROL_WAIT_MS
    while (Date.now() < deadline && !customerSub.seen.notificationInsert) await sleep(200)
    console.log(customerSub.seen.notificationInsert ? '✅ 对照实验通过：INSERT 事件能送达' : '✗ 对照实验失败：连 INSERT 事件都收不到')
  }

  console.log('\n── 5. 主实验：顾客对这笔订单做一次值不变的更新（remark = remark）──')
  const { error: updErr } = await customer
    .from('orders')
    .update({ remark: shared.remark ?? '' })
    .eq('id', shared.id)
  if (updErr) {
    console.error(`✗ 更新订单失败：${updErr.message}`)
    console.error('  RLS 的 orders_update_customer 策略要求 customer_id = 当前用户。')
  } else {
    const deadline = Date.now() + ORDER_WAIT_MS
    while (Date.now() < deadline && (customerSub.seen.orders === 0 || merchantSub.seen.orders === 0)) {
      await sleep(200)
    }
  }

  // 先补一项：会话表的变更能不能送达（决定 conversations 要不要补进实时通道）
  console.log('\n── 6. 会话表（conversations）是否在实时通道里 ──')
  let sawConversation = null
  const { data: convs } = await customer.from('conversations').select('id,unread_customer').limit(1)
  if (!convs || convs.length === 0) {
    console.log('（顾客名下还没有会话，跳过这一项）')
  } else {
    const conv = convs[0]
    const ch = customer.channel('verify-realtime-conversations')
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, payload => {
      sawConversation = payload.eventType
      console.log(`   ← [顾客] conversations ${payload.eventType}`)
    })
    await new Promise(resolve => {
      const timer = setTimeout(resolve, SUBSCRIBE_TIMEOUT_MS)
      ch.subscribe(s => {
        if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          clearTimeout(timer)
          resolve(s)
        }
      })
    })
    // 值不变的更新，只为触发一次真实事件
    const { error: convErr } = await customer
      .from('conversations')
      .update({ unread_customer: conv.unread_customer })
      .eq('id', conv.id)
    if (convErr) {
      console.log(`（会话更新失败：${convErr.message}，跳过这一项）`)
      sawConversation = null
    } else {
      const deadline = Date.now() + CONTROL_WAIT_MS
      while (Date.now() < deadline && !sawConversation) await sleep(200)
      if (sawConversation) {
        console.log('✅ conversations 的变更能送达（该表已在实时通道里）')
      } else {
        console.log('✗ conversations 的变更收不到 → 该表还没加入 supabase_realtime publication')
        console.log('  （第 3 期 migration 的 20260927000000 就是补这个；不补的后果：')
        console.log('   对方把会话标记已读、或新建会话时，这边不会实时刷新，要等有新消息才同步。）')
      }
    }
    await customer.removeChannel(ch)
  }

  console.log('\n── 7. 结论 ──')
  const customerGot = customerSub.seen.orders > 0
  const merchantGot = merchantSub.seen.orders > 0
  console.log(`   顾客端收到 ${customerSub.seen.orders} 条，商家端收到 ${merchantSub.seen.orders} 条`)
  console.log(`   orders 事件的 old 字段：顾客端 ${customerSub.seen.lastOldKeys} / 商家端 ${merchantSub.seen.lastOldKeys}`)
  if (customerGot && merchantGot) {
    console.log('✅ 跨端实时推送可用：顾客改单，商家端不刷新就能收到。')
    exitCode = 0
  } else if (customerGot && !merchantGot) {
    console.log('⚠️ 顾客端收到了，商家端没收到。')
    console.log('   排查：① 商家账号是否真的是这家店的 owner（shops.owner_id）；')
    console.log('         ② orders 的读策略 can_see_order 对商家是否成立（is_shop_owner(shop_id)）。')
  } else if (!customerGot && !merchantGot) {
    console.log('✗ 两端都没收到订单更新。')
    console.log(customerSub.seen.notificationInsert
      ? '   对照实验说明「通道是通的、INSERT 能送达」，那么问题在 orders 的 UPDATE 事件被丢弃。'
      : '   连对照实验的 INSERT 都没收到 → 通道/权限本身有问题，先排查 publication 与账号。')
  } else {
    console.log('⚠️ 只有商家端收到（顾客端没收到），属异常，请把上面输出发给我。')
  }
} catch (err) {
  console.error('✗ 脚本执行出错：', err)
} finally {
  if (notificationId) {
    const { error } = await customer.from('notifications').delete().eq('id', notificationId)
    console.log(error ? `\n（清理对照数据失败：${error.message}，可手动删 id=${notificationId}）` : '\n✅ 已清理对照实验写入的数据')
  }
  for (const sb of [customer, merchant]) {
    try {
      for (const ch of sb.getChannels()) await sb.removeChannel(ch)
      await sb.auth.signOut()
    } catch {
      // 清理阶段的异常不改变结论
    }
  }
  process.exit(exitCode)
}

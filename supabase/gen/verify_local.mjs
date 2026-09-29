/**
 * 离线校验全部迁移脚本：把 supabase/migrations/ 下的 SQL 真实跑在
 * WASM 版 Postgres（PGlite）上，逐条报告失败的语句。
 * 执行顺序与 Supabase 一致：按文件名排序；seed 与后续增量脚本都连跑两遍，
 * 第二遍用于验证「可重复执行」（历史上正是一次重跑踩到了唯一约束冲突）。
 *
 * 为什么需要它：PostgreSQL 在 CREATE FUNCTION / CREATE POLICY 时会校验引用的表与类型，
 * 迁移脚本存在"函数排在建表之前""枚举值漏引号"之类的顺序/语法问题时，
 * 只有真的执行一遍才会暴露。用它在本地先跑通，就不必拿 Supabase 控制台试错。
 *
 * 用法（PGlite 只用于本地校验，不入 package.json）：
 *   mkdir %TEMP%\jw-sqlcheck && cd %TEMP%\jw-sqlcheck
 *   npm init -y && npm install @electric-sql/pglite --registry=https://registry.npmmirror.com
 *   copy "<仓库路径>\supabase\gen\verify_local.mjs" .
 *   node verify_local.mjs "<仓库路径>"
 *
 * ⚠️ 为什么必须先把脚本复制过去：Node 的 ESM 按「脚本所在的目录」解析裸包名，
 *    不认当前工作目录。直接 `node <仓库路径>\supabase\gen\verify_local.mjs` 会报
 *    Cannot find package '@electric-sql/pglite'（即使 PGlite 就装在当前目录）。
 *
 * 说明：本地没有 Supabase 的 auth / storage 组件，脚本会用等价桩对象代替；
 * 本地也没有 pgcrypto，crypt/gen_salt 会用函数桩替代（Supabase 上 pgcrypto 是自带的）。
 * 因此本脚本验证的是"结构、顺序、语法、约束"，不是加密强度。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

// 默认取脚本自身所在的仓库根；若把脚本复制到别处执行（例如临时目录里装了 PGlite），
// 可把仓库路径作为第一个参数传进来：node verify_local.mjs "E:\path\to\jianwei-codex"
const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INIT = path.join(ROOT, 'supabase/migrations/20260915000000_init_schema.sql');
const SEED = path.join(ROOT, 'supabase/migrations/20260915010000_seed_demo.sql');
// 其余补充 migration（第 3 期起新增的脚本）：按文件名顺序，在 seed 之后执行。
// 新增脚本不用改本文件，放进 supabase/migrations/ 即可被自动纳入校验。
const MIGRATION_DIR = path.join(ROOT, 'supabase/migrations');
const EXTRA = fs
  .readdirSync(MIGRATION_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort()
  .filter(f => f !== path.basename(INIT) && f !== path.basename(SEED))
  .map(f => path.join(MIGRATION_DIR, f));

const db = new PGlite();

// ── 1. 模拟 Supabase 平台自带的对象（真实环境里由平台提供） ──────────────
const platformStub = `
create role anon;
create role authenticated;
create role service_role;
create schema if not exists auth;
create schema if not exists storage;

create table auth.users (
  instance_id        uuid,
  id                 uuid primary key,
  aud                text,
  role               text,
  email              text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  raw_app_meta_data  jsonb,
  raw_user_meta_data jsonb,
  -- 与真实 Supabase 一致：这几列「可为空但没有默认值」，
  -- 省略不写就是 null，而认证服务按非空字符串解析它们 → 登录报
  -- "Database error querying schema"（曾经真实踩过，见下方断言）。
  confirmation_token      text,
  email_change            text,
  email_change_token_new  text,
  recovery_token          text
);

create table auth.identities (
  provider_id     text,
  user_id         uuid,
  identity_data   jsonb,
  provider        text,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz,
  -- 与真实 Supabase 一致的两个唯一约束：
  -- 少了它们，seed 里「先插新行再改旧行」这类冲突在本地就复现不出来（曾经因此漏检一次）。
  constraint identities_provider_id_provider_unique unique (provider_id, provider),
  constraint identities_user_id_provider_unique     unique (user_id, provider)
);

create or replace function auth.uid() returns uuid language sql stable as $fn$ select null::uuid $fn$;

create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(p text) returns text[]
  language sql immutable as $fn$ select string_to_array(p, '/') $fn$;

create publication supabase_realtime;
`;

console.log('── 1. 搭建平台桩对象 ──');
await db.exec(platformStub);
console.log('✅ 桩对象就绪');

// ── 2. pgcrypto（Supabase 默认可用；本地若无则用等价函数桩） ──────────────
console.log('── 2. 检查 pgcrypto ──');
let hasPgcrypto = true;
try {
  await db.exec('create extension if not exists pgcrypto;');
  console.log('✅ pgcrypto 可用');
} catch (e) {
  hasPgcrypto = false;
  console.log('⚠️  本地无 pgcrypto，改用等价函数桩：' + e.message.split('\n')[0]);
  await db.exec(`
    create or replace function crypt(pw text, salt text) returns text language sql as $fn$ select 'stub-hash'::text $fn$;
    create or replace function gen_salt(kind text) returns text language sql as $fn$ select 'stub-salt'::text $fn$;
  `);
}

/** 按分号切分 SQL，正确跳过 $$ 函数体、单引号字符串与 -- 行注释 */
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  let dollar = null;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (dollar) {
      if (rest.startsWith(dollar)) { buf += dollar; i += dollar.length; dollar = null; continue; }
      buf += sql[i]; i++; continue;
    }
    if (sql[i] === '$') {
      const m = /^\$[A-Za-z_0-9]*\$/.exec(rest);
      if (m) { dollar = m[0]; buf += m[0]; i += m[0].length; continue; }
    }
    if (sql[i] === "'") {
      buf += sql[i]; i++;
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { buf += "''"; i += 2; continue; }
          buf += "'"; i++; break;
        }
        buf += sql[i]; i++;
      }
      continue;
    }
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') { buf += sql[i]; i++; }
      continue;
    }
    if (sql[i] === ';') { out.push(buf); buf = ''; i++; continue; }
    buf += sql[i]; i++;
  }
  if (buf.trim()) out.push(buf);
  return out.map(s => s.trim()).filter(s => s.replace(/--[^\n]*/g, '').trim().length > 0);
}

// ── 3. 跑 init_schema（逐条执行，便于精确定位失败的语句） ────────────────
console.log('\n── 3. 执行 20260915000000_init_schema.sql（逐条） ──');
let initSql = fs.readFileSync(INIT, 'utf8');
if (!hasPgcrypto) initSql = initSql.replace(/create extension if not exists pgcrypto;/i, '-- (本地校验跳过 pgcrypto)');
const stmts = splitStatements(initSql);
console.log(`共切出 ${stmts.length} 条语句`);
let initOk = true;
for (let idx = 0; idx < stmts.length; idx++) {
  try {
    await db.exec(stmts[idx]);
  } catch (e) {
    initOk = false;
    console.log(`❌ 第 ${idx + 1} 条语句失败：${e.message.split('\n')[0]}`);
    console.log(`   语句开头：${stmts[idx].replace(/\s+/g, ' ').slice(0, 160)}`);
    break;
  }
}
if (initOk) console.log('✅ init_schema 全部语句执行通过');

  // ── 4. 跑 seed（连续跑两遍，第二遍同时验证「可重复执行」） ────────────────
if (initOk) {
    const seedSql = fs.readFileSync(SEED, 'utf8');
    for (const round of [1, 2]) {
      console.log(`\n── 4.${round} 执行 20260915010000_seed_demo.sql（第 ${round} 遍） ──`);
      try {
        await db.exec(seedSql);
        console.log(round === 1 ? '✅ seed 执行通过' : '✅ seed 重复执行通过（幂等）');
      } catch (e) {
        console.log(`❌ seed 第 ${round} 遍失败：\n` + e.message);
        break;
      }
    }

  // ── 4b. 跑其余 migration（增量脚本），每份连跑两遍验证可重复执行 ──────────
  if (EXTRA.length === 0) {
    console.log('\n（没有其它 migration 需要执行）');
  }
  for (const file of EXTRA) {
    const name = path.basename(file);
    const sql = fs.readFileSync(file, 'utf8');
    for (const round of [1, 2]) {
      try {
        await db.exec(sql);
        console.log(`✅ ${name} 第 ${round} 遍通过${round === 2 ? '（幂等）' : ''}`);
      } catch (e) {
        console.log(`❌ ${name} 第 ${round} 遍失败：${e.message.split('\n')[0]}`);
        break;
      }
    }
  }

  // ── 5. 自检数字 ────────────────────────────────────────────────────────
  console.log('\n── 5. 自检（期望 shops 9 / categories 26 / dishes 62 / coupons 6 / users 3）──');
  try {
    const r = await db.query(`
      select
        (select count(*) from public.shops)      as shops,
        (select count(*) from public.categories) as categories,
        (select count(*) from public.dishes)     as dishes,
        (select count(*) from public.coupons)    as coupons,
        (select count(*) from auth.users)        as users
    `);
    console.log(r.rows[0]);
  } catch (e) {
    console.log('自检查询失败：' + e.message);
  }

  // ── 6. 冒烟测试：会话语义 id + 三端未读 + 消息外键 ──────────────────────
  //    DDL 能执行 ≠ 设计可用。这里真的插一条会话与一条消息，验证：
  //    conversations.id 用 text 承载前端语义 id（shop:<shopId>）、
  //    messages.conversation_id 的 text 外键、三端未读字段可分别计数。
  //    注意：本地以超级用户运行，RLS 策略本身不在此校验范围内。
  console.log('\n── 6. 冒烟测试：会话与消息 ──');
  try {
    const CUSTOMER = '10000000-0000-4000-8000-000000000001';
    const MERCHANT = '10000000-0000-4000-8000-000000000002';
    const convId = 'shop:00000000-0000-4000-8000-000000000001';
    await db.exec(`
      insert into public.conversations
        (id, conv_type, customer_id, merchant_id, customer_name, merchant_name, unread_customer, unread_merchant, unread_rider)
      values
        ('${convId}', 'shop', '${CUSTOMER}', '${MERCHANT}', '演示顾客', '演示商家', 2, 0, 0);

      insert into public.messages
        (conversation_id, sender_id, sender_role, sender_name, sender_avatar, content)
      values
        ('${convId}', '${MERCHANT}', 'merchant', '演示商家', null, '在的，请问需要什么？');

      update public.conversations
         set unread_customer = unread_customer + 1, last_message = '新消息', last_message_at = now()
       where id = '${convId}';
    `);
    const r = await db.query(`
      select c.id, c.conv_type, c.unread_customer, c.unread_merchant, c.unread_rider, c.last_message,
             (select count(*) from public.messages m where m.conversation_id = c.id) as msgs
        from public.conversations c
    `);
    console.log('✅ 会话语义 id / 三端未读 / 消息外键均可用');
    console.log(r.rows[0]);
  } catch (e) {
    console.log('❌ 冒烟测试失败：' + e.message);
  }

  // ── 7. 断言：演示账号的 token 列不能为 null ─────────────────────────────
  //    真机踩过的坑：手工插入 auth.users 时省略这几列 → null →
  //    Supabase 认证服务读取该行时崩溃，登录返回
  //    500 "Database error querying schema"（连错误密码都报 500）。
  //    由于本地没有 GoTrue，无法端到端复现，只能在此断言「不能为 null」。
  console.log('\n── 7. 断言：演示账号的 token 列必须为空字符串而非 null ──');
  try {
    const r = await db.query(`
      select email,
             (confirmation_token     is null) as t_confirmation,
             (email_change           is null) as t_email_change,
             (email_change_token_new is null) as t_email_change_new,
             (recovery_token         is null) as t_recovery
        from auth.users
       where email like 'phone%'
       order by email
    `);
    const bad = r.rows.filter(x => x.t_confirmation || x.t_email_change || x.t_email_change_new || x.t_recovery);
    if (bad.length > 0) {
      console.log('❌ 有演示账号的 token 列为 null（会导致线上登录 500）：');
      console.log(bad);
    } else {
      console.log(`✅ ${r.rows.length} 个演示账号的四个 token 列均为空字符串`);
    }
  } catch (e) {
    console.log('断言查询失败：' + e.message);
  }

  // ── 8. 断言：Realtime 的前提——订阅的表都在实时通道里 ──────────────────
  //    没进 publication 的表，变更事件根本不会发出
  //    （第 3 期补的是漏掉的 conversations；第 2 期 2h 补的是商家侧配置表）。
  //    "SQL 没报错"不等于"实时推送能用"，所以这里显式查一遍。
  //
  //    注：**不**断言 REPLICA IDENTITY FULL。曾经推断"orders 的读策略要读多列，
  //    默认 replica identity 会让更新事件被静默丢弃"，但用 scripts/verify-realtime.mjs
  //    对真实数据库实测后推翻了该推断（两个演示账号互测，默认设置下商家端正常收到推送）。
  console.log('\n── 8. 断言：Realtime 前提（订阅的表都在 publication 里）──');
  try {
    const r = await db.query(`
      select t.name as table_name,
             (p.tablename is not null) as in_pub
        from (values
                ('orders'), ('order_items'), ('messages'), ('conversations'),
                ('shops'), ('categories'), ('dishes'),
                ('shop_activities'), ('dish_spec_groups'), ('dish_spec_options'), ('dish_extras')
             ) as t(name)
        left join pg_publication_tables p
               on p.pubname = 'supabase_realtime'
              and p.schemaname = 'public'
              and p.tablename = t.name
       order by t.name
    `);
    console.log(r.rows.map(x => `   ${x.table_name}: in_pub=${x.in_pub}`).join('\n'));
    const missing = r.rows.filter(x => !x.in_pub).map(x => x.table_name);
    if (missing.length > 0) {
      console.log(`❌ 这些表不在 supabase_realtime 里，它们的变更不会推送：${missing.join('、')}`);
    } else {
      console.log('✅ 订单、消息、会话与商家侧配置表均在 supabase_realtime 中');
    }
  } catch (e) {
    console.log('断言查询失败：' + e.message);
  }

  // ── 9. 商家配置：完整替换、失败回滚与自定义分类删除 ──────────────
  console.log('\n── 9. 商家规格/加料与分类事务冒烟 ──');
  const merchant = (await db.query(
    "select id from public.profiles where role = 'merchant' limit 1"
  )).rows[0]?.id;
  if (!merchant) throw new Error('缺少演示商家');
  await db.exec(`create or replace function auth.uid() returns uuid language sql stable
    as $fn$ select '${merchant}'::uuid $fn$;`);
  const dish = (await db.query(
    'select d.id from public.dishes d join public.shops s on s.id = d.shop_id where s.owner_id = $1 limit 1',
    [merchant],
  )).rows[0]?.id;
  if (!dish) throw new Error('缺少商家自有菜品');
  const groups = [{
    id: 'a0000000-0000-4000-8000-000000000001', name: '测试规格', sort: 0,
    options: [{ id: 'a0000000-0000-4000-8000-000000000002', label: '标准', priceDelta: 0, sort: 0 }],
  }];
  const extras = [{ id: 'a0000000-0000-4000-8000-000000000003', name: '测试加料', price: 2, sort: 0 }];
  await db.query('select public.replace_dish_options($1, $2::jsonb, $3::jsonb)', [
    dish, JSON.stringify(groups), JSON.stringify(extras),
  ]);
  let counts = (await db.query(`
    select (select count(*) from public.dish_spec_groups where dish_id = $1) as groups,
           (select count(*) from public.dish_extras where dish_id = $1) as extras
  `, [dish])).rows[0];
  if (Number(counts.groups) !== 1 || Number(counts.extras) !== 1) {
    throw new Error('规格和加料未一起保存');
  }
  try {
    await db.query('select public.replace_dish_options($1, $2::jsonb, $3::jsonb)', [
      dish, JSON.stringify(groups), JSON.stringify([{ ...extras[0], price: -1 }]),
    ]);
    throw new Error('非法加料价格意外保存成功');
  } catch (err) {
    if (err.message === '非法加料价格意外保存成功') throw err;
  }
  counts = (await db.query(`
    select (select count(*) from public.dish_spec_groups where dish_id = $1) as groups,
           (select count(*) from public.dish_extras where dish_id = $1) as extras
  `, [dish])).rows[0];
  if (Number(counts.groups) !== 1 || Number(counts.extras) !== 1) {
    throw new Error('失败的规格保存没有回滚');
  }
  await db.query('select public.replace_dish_options($1, $2::jsonb, $3::jsonb)', [
    dish, '[]', '[]',
  ]);
  counts = (await db.query(`
    select (select count(*) from public.dish_spec_groups where dish_id = $1) as groups,
           (select count(*) from public.dish_extras where dish_id = $1) as extras
  `, [dish])).rows[0];
  if (Number(counts.groups) !== 0 || Number(counts.extras) !== 0) {
    throw new Error('空数组未清空规格和加料');
  }
  const ownedShop = (await db.query(
    'select id from public.shops where owner_id = $1 limit 1', [merchant],
  )).rows[0].id;
  const category = (await db.query(
    "insert into public.categories(shop_id, name, is_custom) values ($1, '测试分类', true) returning id",
    [ownedShop],
  )).rows[0].id;
  await db.query(
    "insert into public.dishes(shop_id, category_id, name, price) values ($1, $2, '测试菜品', 1)",
    [ownedShop, category],
  );
  await db.query('select public.delete_custom_category($1)', [category]);
  const left = (await db.query(
    'select count(*) as count from public.dishes where category_id = $1', [category],
  )).rows[0].count;
  if (Number(left) !== 0) throw new Error('删除分类后仍有旧菜品');
  const systemCategory = (await db.query(
    'select id from public.categories where shop_id = $1 and is_custom = false limit 1',
    [ownedShop],
  )).rows[0]?.id;
  if (!systemCategory) throw new Error('缺少系统分类');
  try {
    await db.query('select public.delete_custom_category($1)', [systemCategory]);
    throw new Error('系统分类意外被删除');
  } catch (err) {
    if (err.message === '系统分类意外被删除') throw err;
  }
  const customer = (await db.query(
    "select id from public.profiles where role = 'customer' limit 1"
  )).rows[0]?.id;
  await db.exec(`create or replace function auth.uid() returns uuid language sql stable
    as $fn$ select '${customer}'::uuid $fn$;`);
  try {
    await db.query('select public.replace_dish_options($1, $2::jsonb, $3::jsonb)', [
      dish, JSON.stringify(groups), JSON.stringify(extras),
    ]);
    throw new Error('非店主意外改动规格');
  } catch (err) {
    if (err.message === '非店主意外改动规格') throw err;
  }
  console.log('✅ 规格/加料保存、失败回滚、清空与分类级联删除通过');

  // ── 10. 钱包：断网重试幂等 + 余额支付事务一致性 ──────────────
  console.log('\n── 10. 钱包幂等与余额支付事务冒烟 ──');
  await db.exec(`create or replace function auth.uid() returns uuid language sql stable
    as $fn$ select '${customer}'::uuid $fn$;`);
  await db.query(
    "select public.apply_wallet_txn_once('recharge', 50, '余额充值', '微信支付', null, 'verify-recharge-1')",
  );
  await db.query(
    "select public.apply_wallet_txn_once('recharge', 50, '余额充值', '微信支付', null, 'verify-recharge-1')",
  );
  let walletState = (await db.query(`
    select p.balance,
           (select count(*) from public.wallet_transactions
             where user_id = p.id and idempotency_key = 'verify-recharge-1') as txns
      from public.profiles p where p.id = $1
  `, [customer])).rows[0];
  if (Number(walletState.balance) !== 50 || Number(walletState.txns) !== 1) {
    throw new Error('相同充值操作编号发生重复入账');
  }

  const walletShop = (await db.query('select id from public.shops limit 1')).rows[0].id;
  const paidOrder = 'b0000000-0000-4000-8000-000000000001';
  await db.query(`
    insert into public.orders(
      id, shop_id, customer_id, status, shop_name, total_amount, final_amount, address, pay_expire_at
    ) values ($1, $2, $3, 'pending_payment', '钱包事务测试店', 25, 25, '{}'::jsonb, now() + interval '15 minutes')
  `, [paidOrder, walletShop, customer]);
  await db.query('select public.pay_order_with_balance($1, $2)', [paidOrder, 'verify-order-pay-1']);
  await db.query('select public.pay_order_with_balance($1, $2)', [paidOrder, 'verify-order-pay-1']);
  walletState = (await db.query(`
    select p.balance,
           o.status,
           o.payment_method,
           (select count(*) from public.wallet_transactions
             where user_id = p.id and order_id = $2 and idempotency_key = 'verify-order-pay-1') as txns
      from public.profiles p cross join public.orders o
     where p.id = $1 and o.id = $2
  `, [customer, paidOrder])).rows[0];
  if (Number(walletState.balance) !== 25 || walletState.status !== 'pending'
      || walletState.payment_method !== 'balance' || Number(walletState.txns) !== 1) {
    throw new Error('余额支付没有保持余额、订单与流水一致');
  }

  const rejectedOrder = 'b0000000-0000-4000-8000-000000000002';
  await db.query(`
    insert into public.orders(
      id, shop_id, customer_id, status, shop_name, total_amount, final_amount, address, pay_expire_at
    ) values ($1, $2, $3, 'pending_payment', '钱包事务测试店', 30, 30, '{}'::jsonb, now() + interval '15 minutes')
  `, [rejectedOrder, walletShop, customer]);
  try {
    await db.query('select public.pay_order_with_balance($1, $2)', [rejectedOrder, 'verify-order-pay-insufficient']);
    throw new Error('余额不足的支付意外成功');
  } catch (err) {
    if (err.message === '余额不足的支付意外成功') throw err;
  }
  walletState = (await db.query(`
    select p.balance,
           o.status,
           (select count(*) from public.wallet_transactions
             where user_id = p.id and order_id = $2) as txns
      from public.profiles p cross join public.orders o
     where p.id = $1 and o.id = $2
  `, [customer, rejectedOrder])).rows[0];
  if (Number(walletState.balance) !== 25 || walletState.status !== 'pending_payment'
      || Number(walletState.txns) !== 0) {
    throw new Error('余额不足时钱包事务没有完整回滚');
  }
  console.log('✅ 充值重复请求只入账一次；余额支付一致成功，余额不足完整回滚');
}

await db.close();

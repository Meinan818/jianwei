/**
 * 离线校验两个迁移脚本：把 init_schema.sql 与 seed_demo.sql 真实跑在
 * WASM 版 Postgres（PGlite）上，逐条报告失败的语句。
 *
 * 为什么需要它：PostgreSQL 在 CREATE FUNCTION / CREATE POLICY 时会校验引用的表与类型，
 * 迁移脚本存在"函数排在建表之前""枚举值漏引号"之类的顺序/语法问题时，
 * 只有真的执行一遍才会暴露。用它在本地先跑通，就不必拿 Supabase 控制台试错。
 *
 * 用法（PGlite 只用于本地校验，不入 package.json）：
 *   mkdir %TEMP%\jw-sqlcheck && cd %TEMP%\jw-sqlcheck
 *   npm init -y && npm install @electric-sql/pglite --registry=https://registry.npmmirror.com
 *   node <仓库路径>\supabase\gen\verify_local.mjs
 *
 * 说明：本地没有 Supabase 的 auth / storage 组件，脚本会用等价桩对象代替；
 * 本地也没有 pgcrypto，crypt/gen_salt 会用函数桩替代（Supabase 上 pgcrypto 是自带的）。
 * 因此本脚本验证的是"结构、顺序、语法、约束"，不是加密强度。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INIT = path.join(ROOT, 'supabase/migrations/20260915000000_init_schema.sql');
const SEED = path.join(ROOT, 'supabase/migrations/20260915010000_seed_demo.sql');

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
  raw_user_meta_data jsonb
);

create table auth.identities (
  provider_id     text,
  user_id         uuid,
  identity_data   jsonb,
  provider        text,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz
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

// ── 4. 跑 seed ───────────────────────────────────────────────────────────
if (initOk) {
  console.log('\n── 4. 执行 20260915010000_seed_demo.sql ──');
  try {
    await db.exec(fs.readFileSync(SEED, 'utf8'));
    console.log('✅ seed 执行通过');
  } catch (e) {
    console.log('❌ seed 失败：\n' + e.message);
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
}

await db.close();

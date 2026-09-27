-- ============================================================
-- 第 3 期（Realtime）：把 conversations 补进实时通道
--
-- 前端第 3 期订阅了四张表：orders / order_items / messages / conversations。
-- 其中 orders、order_items、messages 在 init_schema.sql 里已经加进
-- supabase_realtime publication，**唯独 conversations 漏了**。
-- 没进 publication 的表，变更事件根本不会发出，表现为：
--   对方把会话标记已读、或新建了一个会话时，这边不会实时刷新
--   （要等有新消息、由 messages 的事件把会话一起重拉回来才同步）。
--
-- 本文件只做这一件事。
--
-- ⚠️ 刻意**没有**对表设 REPLICA IDENTITY FULL：
--   一开始推断「orders 的读策略 can_see_order 要读多列，默认 replica identity 下
--   更新事件会被静默丢弃」，随后用 scripts/verify-realtime.mjs 实测——**推断不成立**：
--   两个演示账号互测，顾客改单后商家端在默认 replica identity 下正常收到推送
--   （事件载荷里 old 只有 id，正说明用的就是默认设置）。
--   且本项目收到推送后一律重新查库、不读事件载荷，所以 FULL 没有收益，
--   只会增加 WAL 体积。
--
-- 本文件可重复执行（Supabase 控制台重跑、或本地校验脚本跑两遍都不会报错）。
-- ============================================================

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'conversations'
  ) then
    -- 用 execute 执行 DDL，与 init_schema.sql 里枚举 DO 块的写法保持一致
    execute 'alter publication supabase_realtime add table public.conversations';
  end if;
end $$;

-- 自检：四张表都应在实时通道里（缺哪张就显示 false）。
-- 在 Supabase 控制台执行本文件时，会直接看到这四行结果。
select t.name as table_name,
       (p.tablename is not null) as in_realtime_pub
  from (values ('orders'), ('order_items'), ('messages'), ('conversations')) as t(name)
  left join pg_publication_tables p
         on p.pubname = 'supabase_realtime'
        and p.schemaname = 'public'
        and p.tablename = t.name
 order by t.name;

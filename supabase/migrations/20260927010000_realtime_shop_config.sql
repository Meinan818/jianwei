-- ============================================================
-- 第 2 期 2h：把商家侧配置表加进实时通道（顺带补上第 3 期漏掉的 conversations）
--
-- 背景：Supabase Realtime 只会推送「在 supabase_realtime publication 里」的表的变更。
--   · init_schema.sql 已包含 orders / order_items / messages；
--   · conversations 在第 3 期漏了，原本由 20260927000000_realtime_conversations.sql 补；
--   · 本文件再补上商家侧配置表，用于：
--       商家在商家端「上下架 / 改价 / 改库存 / 改店铺公告 / 改营销活动」之后，
--       顾客端**不刷新**就能看到新价格、新下架状态。
--
-- ⚠️ 本文件把上面两种情况**合并**了，而且可重复执行（已在通道里的表会被跳过）。
--    也就是说：**只跑这一份就够了**，不必再单独跑 20260927000000 那份
--    （跑两遍也不会有副作用）。
--
-- 为什么这些表不需要 REPLICA IDENTITY FULL：
--   本项目收到推送后一律「重新查库」，不解析事件载荷，所以默认 replica identity 足够。
--   这一点已用 scripts/verify-realtime.mjs 对真实数据库实测确认（见 docs/交接说明.md）。
--
-- RLS 不受影响：加入 publication 只是「允许发事件」，谁能读到数据仍由各表的 RLS 决定；
--   这几张表的 select 策略都是「登录用户可读」，所以三端都能收到自己的订阅。
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'conversations',
    'shops', 'categories', 'dishes',
    'shop_activities', 'dish_spec_groups', 'dish_spec_options', 'dish_extras'
  ]
  loop
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      -- 用 execute 执行 DDL，与 init_schema.sql 里枚举 DO 块的写法保持一致
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice '已加入实时通道：%', t;
    else
      raise notice '已在实时通道中，跳过：%', t;
    end if;
  end loop;
end $$;

-- 自检：八张表都应在实时通道里（缺哪张就显示 false）。
-- 在 Supabase 控制台执行本文件时，会直接看到这八行结果。
select t.name as table_name,
       (p.tablename is not null) as in_realtime_pub
  from (values
          ('conversations'),
          ('shops'), ('categories'), ('dishes'),
          ('shop_activities'), ('dish_spec_groups'), ('dish_spec_options'), ('dish_extras')
       ) as t(name)
  left join pg_publication_tables p
         on p.pubname = 'supabase_realtime'
        and p.schemaname = 'public'
        and p.tablename = t.name
 order by t.name;

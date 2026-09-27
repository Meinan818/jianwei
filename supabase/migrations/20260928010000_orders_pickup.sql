-- ============================================================
-- 2026-09-28：到店自取订单支持
--
-- 背景：结算页有「外卖配送 / 到店自取」两个选项，但自取只是把收货地址写成「到店自取」，
--   订单本身没有标记 → 出餐后照样进骑手抢单大厅，骑手会接到一单"自取"的订单（用户反馈的 bug）。
--
-- 本文件做两件事（都可重复执行）：
--   ① orders 增加 is_pickup 标记；
--   ② 状态机允许「自取单」从 ready 直接到 delivered（商家/顾客确认已取餐就完成），
--      外卖单仍然只能 ready → picked（等骑手取餐）。
--
-- ⚠️ 需要在 Supabase 控制台 → SQL Editor 执行一次。
-- ============================================================

alter table public.orders
  add column if not exists is_pickup boolean not null default false;

comment on column public.orders.is_pickup is '到店自取订单：不进入骑手抢单大厅，出餐后由商家确认顾客取餐即完成';

create or replace function public.guard_order_transition()
returns trigger language plpgsql as $$
declare allowed order_status[];
begin
  if new.status is not distinct from old.status then return new; end if;
  allowed := case old.status
    when 'pending_payment' then array['pending','cancelled']::order_status[]
    when 'pending'          then array['preparing','rejected','cancelled']::order_status[]
    when 'preparing'        then array['ready']::order_status[]
    when 'ready'            then case
                                   when coalesce(new.is_pickup, false)
                                     then array['picked','delivered']::order_status[]  -- 自取：可直接完成
                                   else array['picked']::order_status[]                 -- 外卖：等骑手取餐
                                 end
    when 'picked'           then array['delivering']::order_status[]
    when 'delivering'       then array['delivered']::order_status[]
    else array[]::order_status[]
  end;
  if not (new.status = any(allowed)) then
    raise exception '非法订单状态流转: % -> %', old.status, new.status;
  end if;
  return new;
end $$;

-- 自检：应返回一行 is_pickup
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'orders' and column_name = 'is_pickup';
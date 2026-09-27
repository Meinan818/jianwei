-- ============================================================
-- 2026-09-28：清理被 bug 写重复的订单明细（order_items）+ 加唯一索引防止再犯
--
-- 背景：`upsertOrder` 曾经每次回写都把订单明细整个再插一遍，而 order_items 在本项目里
--   是「下单快照、不可改」——RLS 只给了 select / insert 两条策略（没有 delete），
--   表上也没有唯一约束。于是同一笔订单被写成 4 条 / 96 条 / 192 条一模一样的明细行，
--   商家端与顾客端都显示成一长串同样的菜。
--   代码侧已改成「只在新订单时写明细」（见 src/data/orders-remote.ts），本文件负责收尾：
--     ① 把历史脏数据去重；② 加唯一索引，万一以后又写重了会直接撞冲突而不是静默堆积。
--
-- ⚠️ 必须在 Supabase 控制台 → SQL Editor 里执行：
--   应用侧刻意没有 order_items 的删除权限（明细是快照，不该被前端删），
--   所以这一步只能人工在控制台跑（控制台用 service_role，不受 RLS 限制）。
--
-- 可重复执行：第二遍不会再删任何行，索引已存在会跳过。
-- ============================================================

-- ① 去重：同一笔订单里，同一个菜品组合（sku_key + 菜名）只保留 sort 最小的一行
with ranked as (
  select id,
         row_number() over (
           partition by order_id, coalesce(sku_key, ''), dish_name
           order by sort, id
         ) as rn
    from public.order_items
)
delete from public.order_items o
 using ranked r
 where o.id = r.id
   and r.rn > 1;

-- ② 防止再犯：同一笔订单里 sort 必须唯一。
--    应用写入时 sort = 明细行下标，天然唯一；重复插入会撞这个索引（23505），
--    而不是像以前那样悄悄堆出一串重复行。
create unique index if not exists order_items_order_sort_key
  on public.order_items(order_id, sort);

-- ③ 自检：跑完应当「明细合计 = 商品小计」，金额一致 = true
select o.order_seq as 单号,
       o.status as 状态,
       count(i.id) as 明细行数,
       sum(i.quantity) as 合计份数,
       sum(i.final_price * i.quantity) as 明细合计,
       o.total_amount as 商品小计,
       (sum(i.final_price * i.quantity) = o.total_amount) as 金额一致
  from public.orders o
  left join public.order_items i on i.order_id = o.id
 group by o.id, o.order_seq, o.status, o.total_amount
 order by o.order_seq desc
 limit 15;
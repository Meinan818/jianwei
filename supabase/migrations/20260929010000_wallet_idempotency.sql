-- ============================================================
-- 2026-09-29：钱包网络失败恢复与重复记账保护
--
-- ① 每次钱包操作携带 idempotency_key；同一用户的同一个 key 只记一次账。
-- ② 余额支付在一个事务内完成「扣余额 + 写流水 + 订单待支付→待接单」。
-- ③ 客户端收不到响应时可以用同一个 key 安全重试，数据库返回首次结果。
--
-- 可重复执行；上线前需在 Supabase SQL Editor 执行一次。
-- ============================================================

alter table public.wallet_transactions
  add column if not exists idempotency_key text;

create unique index if not exists wallet_user_idempotency_idx
  on public.wallet_transactions(user_id, idempotency_key)
  where idempotency_key is not null;

comment on column public.wallet_transactions.idempotency_key is
  '客户端操作编号；同一用户同一个编号只允许产生一条流水，用于断网安全重试';

create or replace function public.apply_wallet_txn_once(
  p_type wallet_txn_type,
  p_amount numeric,
  p_title text,
  p_description text,
  p_order_id uuid,
  p_idempotency_key text
) returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_balance numeric;
  v_txn public.wallet_transactions;
begin
  if v_uid is null then raise exception '请先登录'; end if;
  if v_key = '' or length(v_key) > 160 then raise exception '无效的钱包操作编号'; end if;
  if p_amount = 0 then raise exception '记账金额不能为零'; end if;
  if (p_type in ('recharge','refund','reward','earn') and p_amount < 0)
     or (p_type in ('consume','withdraw') and p_amount > 0) then
    raise exception '记账方向与流水类型不一致';
  end if;

  -- 锁住本人的余额行，让同一账号的并发记账串行执行。
  select balance into v_balance
    from public.profiles
   where id = v_uid
   for update;
  if not found then raise exception '钱包账户不存在'; end if;

  select * into v_txn
    from public.wallet_transactions
   where user_id = v_uid and idempotency_key = v_key;
  if found then
    if v_txn.type is distinct from p_type
       or v_txn.amount is distinct from p_amount
       or v_txn.order_id is distinct from p_order_id then
      raise exception '钱包操作编号已被其他交易使用';
    end if;
    return v_txn;
  end if;

  v_balance := v_balance + p_amount;
  if v_balance < 0 then raise exception '钱包余额不足'; end if;

  update public.profiles set balance = v_balance where id = v_uid;
  insert into public.wallet_transactions(
    user_id, type, amount, balance_after, title, description, order_id, idempotency_key
  ) values (
    v_uid, p_type, p_amount, v_balance, p_title, coalesce(p_description, ''), p_order_id, v_key
  ) returning * into v_txn;
  return v_txn;
end $$;

create or replace function public.pay_order_with_balance(
  p_order_id uuid,
  p_idempotency_key text
) returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_balance numeric;
  v_now timestamptz := now();
  v_order public.orders;
  v_txn public.wallet_transactions;
begin
  if v_uid is null then raise exception '请先登录'; end if;
  if v_key = '' or length(v_key) > 160 then raise exception '无效的钱包操作编号'; end if;

  -- 与普通钱包记账采用相同锁顺序：先余额、后订单，避免并发死锁。
  select balance into v_balance
    from public.profiles
   where id = v_uid
   for update;
  if not found then raise exception '钱包账户不存在'; end if;

  select * into v_txn
    from public.wallet_transactions
   where user_id = v_uid and idempotency_key = v_key;
  if found then
    if v_txn.type <> 'consume'
       or v_txn.order_id is distinct from p_order_id then
      raise exception '钱包操作编号已被其他交易使用';
    end if;
    return v_txn;
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id and customer_id = v_uid
   for update;
  if not found then raise exception '订单不存在或无权支付'; end if;
  if v_order.status <> 'pending_payment' then raise exception '订单已支付或状态已变更'; end if;
  if v_order.pay_expire_at is not null and v_order.pay_expire_at <= v_now then
    raise exception '订单支付已超时';
  end if;
  if v_order.final_amount <= 0 then raise exception '订单金额无效'; end if;
  if v_balance < v_order.final_amount then raise exception '钱包余额不足'; end if;

  v_balance := v_balance - v_order.final_amount;
  update public.profiles set balance = v_balance where id = v_uid;

  insert into public.wallet_transactions(
    user_id, type, amount, balance_after, title, description, order_id, idempotency_key
  ) values (
    v_uid,
    'consume',
    -v_order.final_amount,
    v_balance,
    '订单支付 ' || right(p_order_id::text, 6),
    '订单 ' || right(p_order_id::text, 6),
    p_order_id,
    v_key
  ) returning * into v_txn;

  update public.orders
     set status = 'pending',
         payment_method = 'balance',
         paid_at = v_now,
         pay_expire_at = null,
         status_timeline = jsonb_build_array(
           jsonb_build_object('status','pending','label','已下单','time',to_char(v_now at time zone 'Asia/Shanghai','HH24:MI'),'completed',true),
           jsonb_build_object('status','preparing','label','商家接单','time','','completed',false),
           jsonb_build_object('status','ready','label','商家出餐','time','','completed',false),
           jsonb_build_object('status','picked','label','骑手取餐','time','','completed',false),
           jsonb_build_object('status','delivering','label','配送中','time','','completed',false),
           jsonb_build_object('status','delivered','label','已送达','time','','completed',false)
         )
   where id = p_order_id;

  return v_txn;
end $$;

-- 自检：应返回 idempotency_key 这一行。
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'wallet_transactions'
   and column_name = 'idempotency_key';

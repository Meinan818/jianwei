-- 会员开通：¥15 / 30 天。微信、支付宝是演示支付，余额支付真实修改模拟钱包。
-- 会员资格、付款记录和余额消费流水原子提交；同一 attempt_id 重试只处理一次。
-- 此迁移可重复执行，不改写已有会员或钱包记录。
create table if not exists public.membership_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  attempt_id uuid not null,
  payment_method text not null check (payment_method in ('wechat','alipay','balance')),
  amount numeric(10,2) not null check (amount = 15),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  wallet_txn_id uuid references public.wallet_transactions(id),
  unique (user_id, attempt_id),
  check (expires_at > starts_at)
);
alter table public.membership_purchases enable row level security;
drop policy if exists membership_read_own on public.membership_purchases;
create policy membership_read_own on public.membership_purchases
  for select to authenticated using (user_id = auth.uid());
grant select on public.membership_purchases to authenticated;

create or replace function public.purchase_membership(p_method text, p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_purchase public.membership_purchases;
  v_txn public.wallet_transactions;
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then raise exception '请先登录'; end if;
  if p_attempt_id is null then raise exception '缺少付款操作编号'; end if;
  if p_method is null or p_method not in ('wechat','alipay','balance') then
    raise exception '不支持的会员支付方式';
  end if;
  -- 与钱包记账保持同一锁顺序；不同窗口同时开通也只会有一次付款。
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found or v_profile.role <> 'customer' then raise exception '仅顾客可开通会员'; end if;
  select * into v_purchase from public.membership_purchases
    where user_id = v_uid and attempt_id = p_attempt_id;
  if found then
    if v_purchase.payment_method <> p_method then raise exception '请使用原支付方式重试'; end if;
    select * into v_txn from public.wallet_transactions where id = v_purchase.wallet_txn_id;
  else
    if v_profile.is_vip and v_profile.vip_expire_at > v_now then
      raise exception '会员仍在有效期内，无需重复开通';
    end if;
    if p_method = 'balance' then
      if v_profile.balance < 15 then raise exception '钱包余额不足'; end if;
      v_profile.balance := v_profile.balance - 15;
      insert into public.wallet_transactions(user_id,type,amount,balance_after,title,description,idempotency_key)
        values (v_uid,'consume',-15,v_profile.balance,'会员开通','VIP 会员 30 天',
          'membership:' || p_attempt_id::text) returning * into v_txn;
    end if;
    -- 真实微信/支付宝回调接入点：正式支付需由服务端验证支付结果后才能执行本事务。
    insert into public.membership_purchases(user_id,attempt_id,payment_method,amount,starts_at,expires_at,wallet_txn_id)
      values (v_uid,p_attempt_id,p_method,15,v_now,v_now + interval '30 days',v_txn.id)
      returning * into v_purchase;
    update public.profiles set balance = v_profile.balance, is_vip = true,
      vip_expire_at = v_purchase.expires_at where id = v_uid returning * into v_profile;
  end if;
  -- 返回当前账户值，重试旧付款不能把余额或有效期覆盖成历史值。
  return jsonb_build_object(
    'profile', jsonb_build_object('balance',v_profile.balance,'growth_points',v_profile.growth_points,
      'total_spent',v_profile.total_spent,'is_vip',v_profile.is_vip,'vip_expire_at',v_profile.vip_expire_at),
    'purchase', to_jsonb(v_purchase), 'wallet_record', to_jsonb(v_txn));
end $$;
revoke all on function public.purchase_membership(text,uuid) from public;
grant execute on function public.purchase_membership(text,uuid) to authenticated;

select routine_name from information_schema.routines
 where routine_schema = 'public' and routine_name = 'purchase_membership';

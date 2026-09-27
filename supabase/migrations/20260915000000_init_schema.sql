-- =============================================================================
-- 简味点单 · Supabase 初始化迁移（设计稿 v0.1，待评审）
-- 覆盖：三端账号 / 店铺菜品 / 订单全链路 / IM / 评价 / 券与会员钱包 / 通知收藏
-- 约定：
--   1. 主键统一 uuid（gen_random_uuid）；金额 numeric(10,2)；时间 timestamptz
--   2. 「一账号一店铺」由 shops.owner_id 的 UNIQUE 约束 + RLS 双重保证
--   3. anon key 设计上公开，所有安全边界都在本文件的 RLS 策略里
--   4. 订单/消息等历史快照类数据（菜名、地址、头像）冗余存表，不随基础资料变更而改写
-- 执行顺序：本文件一次性在 Supabase SQL Editor 执行；演示数据见后续 seed 文件
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 一、枚举类型（与前端 src/data/*.ts 的字面量联合类型一一对应）
-- -----------------------------------------------------------------------------
create type user_role                as enum ('customer', 'merchant', 'rider');
create type order_status              as enum ('pending_payment','pending','preparing','ready','picked','delivering','delivered','cancelled','rejected');
create type refund_status             as enum ('pending','approved','rejected','processing','completed');
create type delivery_exception_type   as enum ('customer_unreachable','merchant_slow','wrong_address','bad_weather','other');
create type actor_role                as enum ('customer','merchant','rider','system');
create type delivery_mode             as enum ('instant','appointment');
create type activity_type             as enum ('fullReduce','newUser','discount','discountDish','freeDelivery');
create type coupon_type               as enum ('fullReduce','discount','noThreshold');
create type user_coupon_status        as enum ('claimed','used','expired');
create type wallet_txn_type           as enum ('recharge','consume','refund','reward','withdraw','earn');
create type point_txn_type            as enum ('earn','spend','expire');
create type withdraw_status           as enum ('pending','success','failed');
create type account_type              as enum ('alipay','wechat','bank');
create type address_tag               as enum ('home','company','school','none');
create type notification_category     as enum ('system','order','activity');
create type message_type              as enum ('text','system');

-- -----------------------------------------------------------------------------
-- 二、通用工具函数
-- -----------------------------------------------------------------------------
-- 自动维护 updated_at（纯触发器函数，不引用任何业务表，可以最先定义）
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- 注意：current_role / is_shop_owner / can_see_order 引用了 profiles、shops、orders 三张表，
-- 必须定义在建表之后，见下方「通用工具函数（建表后定义）」一节。

-- =============================================================================
-- 三、账号域：profiles（与 Supabase Auth 的 auth.users 1:1）
-- =============================================================================
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           user_role not null,
  phone          text,                                   -- 演示用手机号（不接真实短信）
  nickname       text not null default '',
  avatar_url     text,
  rider_no       text,                                   -- 骑手工号
  is_online      boolean not null default false,        -- 骑手上下线
  -- 会员/钱包（会员等级由 growth_points 按前端阈值推导，不单独存 level）
  balance        numeric(10,2) not null default 0 check (balance >= 0),
  growth_points  integer not null default 0,
  total_spent    numeric(10,2) not null default 0,
  is_vip         boolean not null default false,
  vip_expire_at  timestamptz,
  pay_password   text not null default '123456',        -- MOCK：演示支付密码，非真实安全措施
  created_at     timestamptz not null default now()
);
-- 三端账号池独立：同一手机号可在三个端各注册一个账号
create unique index profiles_phone_role_uniq on public.profiles(phone, role) where phone is not null;

-- 注册时自动建 profile：角色从注册元数据 raw_user_meta_data.role 带入
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, phone, nickname, avatar_url)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'customer'),
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'nickname', '简味用户'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 四、商家域：shops / categories / dishes / 规格加料 / 营销活动
-- =============================================================================
create table public.shops (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid unique references public.profiles(id) on delete set null, -- ★ 一账号一店铺
  name                text not null,
  tagline             text,
  cover_url           text,
  category            text,
  rating              numeric(2,1) not null default 5.0 check (rating between 0 and 5),
  month_sales         integer not null default 0,
  min_order           numeric(10,2) not null default 0,
  delivery_fee        numeric(10,2) not null default 0,
  packing_fee         numeric(10,2) not null default 0,
  delivery_time       text,
  distance            text,
  address             text,
  phone               text,
  description         text,
  business_hours      text,
  announcement        text not null default '',
  is_open             boolean not null default true,    -- 营业开关，打烊时顾客端不可下单
  support_appointment boolean not null default false,
  appointment_slots   jsonb not null default '[]'::jsonb,
  free_delivery_min   numeric(10,2),
  is_demo             boolean not null default false,   -- 内置演示店（seed，owner_id 为空，只读）
  created_at          timestamptz not null default now()
);
create index shops_owner_idx on public.shops(owner_id);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index categories_shop_idx on public.categories(shop_id, sort);

create table public.dishes (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  category_id  uuid references public.categories(id) on delete set null,
  name         text not null,
  description  text not null default '',
  price        numeric(10,2) not null check (price >= 0),
  image_url    text,
  sales        integer not null default 0,
  stock        integer not null default -1,             -- -1 = 不限库存
  sold_out     boolean not null default false,
  on_shelf     boolean not null default true,
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index dishes_shop_idx on public.dishes(shop_id);
create index dishes_category_idx on public.dishes(category_id);
create trigger trg_dishes_touch before update on public.dishes
  for each row execute function public.touch_updated_at();

-- 规格组（单选：辣度/份量…）与规格选项
create table public.dish_spec_groups (
  id       uuid primary key default gen_random_uuid(),
  dish_id  uuid not null references public.dishes(id) on delete cascade,
  name     text not null,
  sort     integer not null default 0
);
create index spec_groups_dish_idx on public.dish_spec_groups(dish_id, sort);

create table public.dish_spec_options (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.dish_spec_groups(id) on delete cascade,
  label       text not null,
  price_delta numeric(10,2) not null default 0,
  sort        integer not null default 0
);
create index spec_options_group_idx on public.dish_spec_options(group_id, sort);

-- 加料（多选，每项加价）
create table public.dish_extras (
  id       uuid primary key default gen_random_uuid(),
  dish_id  uuid not null references public.dishes(id) on delete cascade,
  name     text not null,
  price    numeric(10,2) not null default 0 check (price >= 0),
  sort     integer not null default 0
);
create index extras_dish_idx on public.dish_extras(dish_id, sort);

-- 店铺营销活动（满减/新客立减/店铺折扣/折扣菜/免配送费）
create table public.shop_activities (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references public.shops(id) on delete cascade,
  type                activity_type not null,
  name                text not null default '',
  description         text not null default '',
  active              boolean not null default true,
  thresholds          numeric(10,2)[] not null default '{}',  -- 满减档位
  discounts           numeric(10,2)[] not null default '{}',  -- 对应减免
  new_user_amount     numeric(10,2),
  discount_rate       numeric(4,2) check (discount_rate between 0 and 1),
  dish_id             uuid references public.dishes(id) on delete set null, -- 折扣菜
  dish_discount_rate  numeric(4,2) check (dish_discount_rate between 0 and 1),
  free_delivery_min   numeric(10,2),
  created_at          timestamptz not null default now()
);
create index activities_shop_idx on public.shop_activities(shop_id);

-- =============================================================================
-- 五、交易域：orders / order_items / refund_requests / delivery_exceptions
-- =============================================================================
create table public.orders (
  id                       uuid primary key default gen_random_uuid(),
  order_seq                bigint generated always as identity,       -- 人类可读单号（展示用）
  shop_id                  uuid not null references public.shops(id),
  customer_id              uuid not null references public.profiles(id),
  rider_id                 uuid references public.profiles(id),       -- 抢单骑手，未抢为 null
  status                   order_status not null default 'pending_payment',
  -- 店铺快照（防止店铺改名/换图影响历史订单）
  shop_name                text not null,
  shop_cover_url           text,
  -- 金额（全部以元为单位）
  total_amount             numeric(10,2) not null,                    -- 商品小计
  packing_fee              numeric(10,2) not null default 0,
  delivery_fee             numeric(10,2) not null default 0,
  discount                 numeric(10,2) not null default 0,          -- 总优惠
  promo_discount           numeric(10,2) not null default 0,          -- 满减
  coupon_discount          numeric(10,2) not null default 0,          -- 优惠券
  new_user_discount        numeric(10,2) not null default 0,          -- 新客立减
  free_delivery_discount   numeric(10,2) not null default 0,          -- 免配送费
  final_amount             numeric(10,2) not null,                    -- 实付
  discount_detail          jsonb,                                     -- 优惠明细快照
  coupon_info              jsonb,
  promo_info               jsonb,
  -- 收货地址快照：{name,phone,address,detail}
  address                  jsonb not null,
  remark                   text not null default '',
  utensils                 integer not null default 0,
  payment_method           text,
  delivery_mode            delivery_mode not null default 'instant',
  appointment_time         text,
  -- 骑手快照与配送信息
  rider_name               text,
  rider_phone              text,
  rider_earning            numeric(10,2),
  distance                 text,
  estimated_time           text,
  -- 取消/拒单
  reject_reason            text,
  cancel_reason            text,
  cancelled_by             actor_role,
  -- 六节点时间线快照 + 各节点时间戳
  status_timeline          jsonb not null default '[]'::jsonb,
  paid_at                  timestamptz,
  pay_expire_at            timestamptz,
  ready_at                 timestamptz,
  arrived_at               timestamptz,
  picked_at                timestamptz,
  delivering_at            timestamptz,
  delivered_at             timestamptz,
  reviewed                 boolean not null default false,
  sales_counted            boolean not null default false,            -- 送达计销量幂等标记
  urge_count               integer not null default 0,
  last_urge_at             timestamptz,
  urge_reason              text,
  created_at               timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_shop_idx     on public.orders(shop_id, status, created_at desc);
create index orders_rider_idx    on public.orders(rider_id, created_at desc);
-- 抢单大厅：待抢单的部分索引（骑手端高频查询）
create index orders_hall_idx     on public.orders(created_at) where status = 'ready' and rider_id is null;

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  dish_id      uuid,                                                    -- 仅作溯源，不做硬外键（菜品可能被删）
  dish_name    text not null,                                           -- 快照
  image_url    text,
  base_price   numeric(10,2) not null,
  final_price  numeric(10,2) not null,
  quantity     integer not null check (quantity > 0),
  sku_key      text,
  specs        jsonb not null default '[]'::jsonb,                      -- [{specName,optionLabel,priceDelta}]
  extras       jsonb not null default '[]'::jsonb,                      -- [{name,price}]
  sort         integer not null default 0
);
create index order_items_order_idx on public.order_items(order_id);

-- 售后退款（一单至多一个进行中的售后：order_id 唯一）
create table public.refund_requests (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null unique references public.orders(id) on delete cascade,
  shop_id        uuid not null references public.shops(id),
  customer_id    uuid not null references public.profiles(id),
  reason         text not null default '',
  description    text not null default '',
  amount         numeric(10,2) not null,
  status         refund_status not null default 'pending',
  created_at     timestamptz not null default now(),
  handled_at     timestamptz,
  handle_remark  text,
  handled_by     uuid
);
create index refund_shop_idx on public.refund_requests(shop_id, status);

-- 配送异常上报
create table public.delivery_exceptions (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  type           delivery_exception_type not null,
  description    text not null default '',
  reported_by    actor_role not null,
  reporter_id    uuid,
  reporter_name  text,
  resolved       boolean not null default false,
  resolved_at    timestamptz,
  resolution     text,
  created_at     timestamptz not null default now()
);
create index exceptions_order_idx on public.delivery_exceptions(order_id);

-- 订单状态机守卫（可选的服务端硬约束，前端状态流转非法时直接拒绝；如调试不便可 drop 此 trigger）
create or replace function public.guard_order_transition()
returns trigger language plpgsql as $$
declare allowed order_status[];
begin
  if new.status is not distinct from old.status then return new; end if;
  allowed := case old.status
    when 'pending_payment' then array['pending','cancelled']::order_status[]
    when 'pending'          then array['preparing','rejected','cancelled']::order_status[]
    when 'preparing'        then array['ready']::order_status[]
    when 'ready'            then array['picked']::order_status[]   -- 骑手抢单
    when 'picked'           then array['delivering']::order_status[] -- 到店/取餐为时间戳，确认取餐后配送
    when 'delivering'       then array['delivered']::order_status[]
    else array[]::order_status[]
  end;
  if not (new.status = any(allowed)) then
    raise exception '非法订单状态流转: % -> %', old.status, new.status;
  end if;
  return new;
end $$;
create trigger trg_orders_transition before update of status on public.orders
  for each row execute function public.guard_order_transition();

-- =============================================================================
-- 六、顾客资料域：addresses / favorites / footprints
-- =============================================================================
create table public.addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  phone        text not null,
  address      text not null,
  detail       text not null default '',
  tag          address_tag not null default 'none',
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index addresses_customer_idx on public.addresses(customer_id);
-- 每个账号至多一个默认地址
create unique index addresses_one_default on public.addresses(customer_id) where is_default;

create table public.favorites (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  shop_id     uuid not null references public.shops(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create table public.footprints (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  shop_id     uuid not null references public.shops(id) on delete cascade,
  visited_at  timestamptz not null default now()
);
create index footprints_user_idx on public.footprints(user_id, visited_at desc);

-- =============================================================================
-- 七、互动域：conversations / messages / reviews / notifications
-- =============================================================================
create table public.conversations (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid references public.orders(id) on delete set null, -- 下单前咨询可为空
  customer_id    uuid not null references public.profiles(id),
  merchant_id    uuid not null references public.profiles(id),
  rider_id       uuid references public.profiles(id),
  last_message   text,
  last_message_at timestamptz,
  created_at     timestamptz not null default now()
);
create index conversations_customer_idx on public.conversations(customer_id, last_message_at desc);
create index conversations_merchant_idx on public.conversations(merchant_id, last_message_at desc);
create index conversations_rider_idx    on public.conversations(rider_id, last_message_at desc);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id),
  sender_role      actor_role not null,     -- 快照角色，避免头像/名称随资料变
  sender_name      text,
  content          text not null,
  msg_type         message_type not null default 'text',
  is_read          boolean not null default false,
  created_at       timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

create table public.reviews (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null unique references public.orders(id) on delete cascade,
  shop_id           uuid not null references public.shops(id),
  customer_id       uuid not null references public.profiles(id),
  user_name         text,
  user_avatar_url   text,
  overall_score     smallint not null check (overall_score between 1 and 5),
  taste_score       smallint check (taste_score between 1 and 5),
  packaging_score   smallint check (packaging_score between 1 and 5),
  delivery_score    smallint check (delivery_score between 1 and 5),
  tags              text[] not null default '{}',
  content           text not null default '',
  images            text[] not null default '{}',   -- Storage 公开 URL，最多 6 张（前端限制）
  dish_scores       jsonb not null default '[]'::jsonb,
  dishes            text[] not null default '{}',
  anonymous         boolean not null default false,
  merchant_reply    text,
  merchant_reply_at timestamptz,
  created_at        timestamptz not null default now()
);
create index reviews_shop_idx on public.reviews(shop_id, created_at desc);
create index reviews_customer_idx on public.reviews(customer_id);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category    notification_category not null,
  title       text not null,
  content     text not null default '',
  is_read     boolean not null default false,
  order_id    uuid,
  action_url  text,
  icon        text,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, is_read, created_at desc);

-- =============================================================================
-- 八、营销与资金域：coupons / user_coupons / wallet / points / withdraw
-- =============================================================================
-- 平台券模板（领券中心）
create table public.coupons (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         coupon_type not null,
  value        numeric(10,2) not null,       -- 满减/无门槛=减免额；折扣=0.8
  min_amount   numeric(10,2) not null default 0,
  expire_date  date not null,
  scope        text not null default '全场通用',
  description  text not null default '',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- 用户领券记录（对应前端 claimed/used/expired 三态）
create table public.user_coupons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  coupon_id   uuid not null references public.coupons(id),
  status      user_coupon_status not null default 'claimed',
  claimed_at  timestamptz not null default now(),
  used_at     timestamptz,
  order_id    uuid,
  unique (user_id, coupon_id)
);
create index user_coupons_user_idx on public.user_coupons(user_id, status);

-- 钱包流水（append-only，余额以 profiles.balance 为准，流水只追加不改写）
create table public.wallet_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  type           wallet_txn_type not null,
  amount         numeric(10,2) not null,     -- 带符号：收入为正、支出为负
  balance_after  numeric(10,2) not null,
  title          text not null,
  description    text,
  order_id       uuid,
  created_at     timestamptz not null default now()
);
create index wallet_user_idx on public.wallet_transactions(user_id, created_at desc);

create table public.point_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         point_txn_type not null,
  amount       integer not null,             -- 带符号
  description  text not null default '',
  order_id     uuid,
  created_at   timestamptz not null default now()
);
create index points_user_idx on public.point_records(user_id, created_at desc);

-- 提现记录（顾客钱包 / 商家财务 / 骑手收入共用，actor_role 区分）
create table public.withdraw_records (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid not null references public.profiles(id) on delete cascade,
  actor_role     user_role not null,
  amount         numeric(10,2) not null,
  fee            numeric(10,2) not null default 0,
  arrive_amount  numeric(10,2) not null,
  status         withdraw_status not null default 'pending',
  account        text not null default '',
  account_type   account_type not null default 'wechat',
  created_at     timestamptz not null default now(),
  arrive_at      timestamptz,
  remark         text
);
create index withdraw_actor_idx on public.withdraw_records(actor_id, created_at desc);

-- =============================================================================
-- 九、行级安全 RLS（anon key 公开是正常的，安全全部靠这里）
-- =============================================================================
-- 先批量开启
alter table public.profiles            enable row level security;
alter table public.shops               enable row level security;
alter table public.categories          enable row level security;
alter table public.dishes              enable row level security;
alter table public.dish_spec_groups    enable row level security;
alter table public.dish_spec_options   enable row level security;
alter table public.dish_extras         enable row level security;
alter table public.shop_activities     enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.refund_requests     enable row level security;
alter table public.delivery_exceptions enable row level security;
alter table public.addresses           enable row level security;
alter table public.favorites           enable row level security;
alter table public.footprints          enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.reviews             enable row level security;
alter table public.notifications       enable row level security;
alter table public.coupons             enable row level security;
alter table public.user_coupons        enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.point_records       enable row level security;
alter table public.withdraw_records    enable row level security;

-- -----------------------------------------------------------------------------
-- 通用工具函数（必须排在所有建表语句之后）
--   PostgreSQL 在 CREATE FUNCTION 时会校验函数体与参数里引用的表/类型，因此：
--     1) 这三个函数依赖 profiles / shops / orders，必须排在建表之后；
--     2) 下面 is_dish_owner…can_see_order_id 那批函数又引用了 is_shop_owner，
--        所以本段必须排在那批函数之前。
--   顺序写错会报 `relation "public.profiles" does not exist`
--   或 `function public.is_shop_owner(uuid) does not exist`。
-- -----------------------------------------------------------------------------
-- 当前登录用户的角色
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- 判断当前登录用户是否为某店铺店主（RLS 复用，避免重复子查询）
create or replace function public.is_shop_owner(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shops s
    where s.id = p_shop_id and s.owner_id = auth.uid()
  );
$$;

-- 判断当前用户能否看到某订单（顾客本人 / 店铺商家 / 接单骑手 / 抢单大厅里的待抢单）
create or replace function public.can_see_order(p_order public.orders)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return p_order.customer_id = auth.uid()
      or public.is_shop_owner(p_order.shop_id)
      or p_order.rider_id = auth.uid()
      or (p_order.status = 'ready' and p_order.rider_id is null);
end $$;

-- 子表归属判断辅助
create or replace function public.is_dish_owner(p_dish_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dishes d join public.shops s on s.id = d.shop_id
    where d.id = p_dish_id and s.owner_id = auth.uid()
  );
$$;
create or replace function public.is_spec_group_owner(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dish_spec_groups g
    join public.dishes d on d.id = g.dish_id
    join public.shops s on s.id = d.shop_id
    where g.id = p_group_id and s.owner_id = auth.uid()
  );
$$;
create or replace function public.can_see_order_id(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id and (
      o.customer_id = auth.uid()
      or public.is_shop_owner(o.shop_id)
      or o.rider_id = auth.uid()
      or (o.status = 'ready' and o.rider_id is null)
    )
  );
$$;
create or replace function public.is_conversation_participant(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conv
      and auth.uid() in (c.customer_id, c.merchant_id, coalesce(c.rider_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );
$$;

-- ---- profiles：登录后可读（三端要互相看到昵称头像），仅能改自己 ----
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---- shops：登录可读；只有 merchant 角色能建店，且 owner 必须是自己；唯一 owner_id 保证一账号一店 ----
create policy shops_select on public.shops for select to authenticated using (true);
create policy shops_insert_owner on public.shops for insert to authenticated
  with check (owner_id = auth.uid() and public.current_role() = 'merchant');
create policy shops_update_owner on public.shops for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy shops_delete_owner on public.shops for delete to authenticated using (owner_id = auth.uid());

-- ---- 店铺子表（分类/菜品/规格/加料/活动）：登录可读，仅店主可写 ----
create policy categories_select on public.categories for select to authenticated using (true);
create policy categories_write   on public.categories for all to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

create policy dishes_select on public.dishes for select to authenticated using (true);
create policy dishes_write   on public.dishes for all to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

create policy spec_groups_select on public.dish_spec_groups for select to authenticated using (true);
create policy spec_groups_write   on public.dish_spec_groups for all to authenticated
  using (public.is_dish_owner(dish_id)) with check (public.is_dish_owner(dish_id));

create policy spec_options_select on public.dish_spec_options for select to authenticated using (true);
create policy spec_options_write   on public.dish_spec_options for all to authenticated
  using (public.is_spec_group_owner(group_id)) with check (public.is_spec_group_owner(group_id));

create policy extras_select on public.dish_extras for select to authenticated using (true);
create policy extras_write   on public.dish_extras for all to authenticated
  using (public.is_dish_owner(dish_id)) with check (public.is_dish_owner(dish_id));

create policy activities_select on public.shop_activities for select to authenticated using (true);
create policy activities_write   on public.shop_activities for all to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

-- ---- orders：顾客看自己的、商家看本店的、骑手看自己接的 + 抢单大厅 ----
create policy orders_select on public.orders for select to authenticated
  using (public.can_see_order(orders.*));
-- 下单：只能以自己为顾客
create policy orders_insert_customer on public.orders for insert to authenticated
  with check (customer_id = auth.uid() and public.current_role() = 'customer');
-- 改单（三条 permissive 策略取并集；状态合法性另由状态机 trigger 兜底）
create policy orders_update_customer on public.orders for update to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy orders_update_merchant on public.orders for update to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));
create policy orders_update_rider on public.orders for update to authenticated
  using (rider_id = auth.uid() or (status = 'ready' and rider_id is null))
  with check (rider_id = auth.uid());

-- ---- order_items：随订单可见；仅顾客在自己订单下写入（快照不可改） ----
create policy items_select on public.order_items for select to authenticated
  using (public.can_see_order_id(order_id));
create policy items_insert on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o
    where o.id = order_id and o.customer_id = auth.uid()));

-- ---- 售后：顾客与店主可见；顾客发起、店主处理 ----
create policy refunds_select on public.refund_requests for select to authenticated
  using (customer_id = auth.uid() or public.is_shop_owner(shop_id));
create policy refunds_insert_customer on public.refund_requests for insert to authenticated
  with check (customer_id = auth.uid());
create policy refunds_update_merchant on public.refund_requests for update to authenticated
  using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

-- ---- 配送异常：随订单可见；上报人写入/更新 ----
create policy exceptions_select on public.delivery_exceptions for select to authenticated
  using (public.can_see_order_id(order_id));
create policy exceptions_insert on public.delivery_exceptions for insert to authenticated
  with check (reporter_id = auth.uid());
create policy exceptions_update on public.delivery_exceptions for update to authenticated
  using (reporter_id = auth.uid() or exists (
    select 1 from public.orders o where o.id = order_id and public.is_shop_owner(o.shop_id)))
  with check (reporter_id = auth.uid() or exists (
    select 1 from public.orders o where o.id = order_id and public.is_shop_owner(o.shop_id)));

-- ---- 顾客私有数据：仅本人 ----
create policy addresses_owner on public.addresses for all to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy favorites_owner on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy footprints_owner on public.footprints for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_owner on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_coupons_owner on public.user_coupons for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wallet_owner on public.wallet_transactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy points_owner on public.point_records for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy withdraw_owner on public.withdraw_records for all to authenticated
  using (actor_id = auth.uid()) with check (actor_id = auth.uid());

-- ---- IM：仅会话三方可见可写 ----
create policy conv_select on public.conversations for select to authenticated
  using (public.is_conversation_participant(id));
create policy conv_insert on public.conversations for insert to authenticated with check (
  auth.uid() in (customer_id, merchant_id) or customer_id = auth.uid());
create policy conv_update on public.conversations for update to authenticated
  using (public.is_conversation_participant(id)) with check (public.is_conversation_participant(id));

create policy msg_select on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));
create policy msg_update on public.messages for update to authenticated
  using (public.is_conversation_participant(conversation_id));

-- ---- 评价：登录可读；顾客只能为自己订单发评价；商家回复走 reply_review RPC ----
create policy reviews_select on public.reviews for select to authenticated using (true);
create policy reviews_insert on public.reviews for insert to authenticated
  with check (customer_id = auth.uid() and public.current_role() = 'customer');

-- ---- 券模板：登录可读，运营侧在 Supabase 控制台维护 ----
create policy coupons_select on public.coupons for select to authenticated using (true);

-- =============================================================================
-- 十、并发安全的 RPC（用 SECURITY DEFINER 把多步操作收成一个原子事务）
-- =============================================================================
-- 1) 钱包记账：原子改余额 + 写流水，余额不足直接回滚
create or replace function public.apply_wallet_txn(
  p_type wallet_txn_type, p_amount numeric, p_title text,
  p_description text default '', p_order_id uuid default null
) returns public.wallet_transactions language plpgsql security definer set search_path = public as $$
declare v_balance numeric; v_txn public.wallet_transactions;
begin
  update public.profiles set balance = balance + p_amount where id = auth.uid() returning balance into v_balance;
  if v_balance < 0 then raise exception '钱包余额不足'; end if;
  insert into public.wallet_transactions(user_id, type, amount, balance_after, title, description, order_id)
  values (auth.uid(), p_type, p_amount, v_balance, p_title, p_description, p_order_id)
  returning * into v_txn;
  return v_txn;
end $$;

-- 2) 骑手抢单：原子 compare-and-set，两个骑手同时抢只有一个成功
create or replace function public.claim_order(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_name text; v_row public.orders;
begin
  if public.current_role() <> 'rider' then raise exception '仅骑手身份可抢单'; end if;
  select nickname into v_name from public.profiles where id = auth.uid();
  update public.orders
     set rider_id = auth.uid(), rider_name = v_name, status = 'picked'
   where id = p_order_id and status = 'ready' and rider_id is null
  returning * into v_row;
  if not found then raise exception '手慢一步，该订单已被其他骑手抢走'; end if;
  return v_row;
end $$;

-- 3) 商家回复评价（只允许改回复两个字段，且必须是该评价所属店铺店主）
create or replace function public.reply_review(p_review_id uuid, p_reply text)
returns public.reviews language plpgsql security definer set search_path = public as $$
declare v_row public.reviews;
begin
  update public.reviews r set merchant_reply = p_reply, merchant_reply_at = now()
   where r.id = p_review_id and public.is_shop_owner(r.shop_id)
  returning * into v_row;
  if not found then raise exception '无权回复该评价或评价不存在'; end if;
  return v_row;
end $$;

-- =============================================================================
-- 十一、Realtime：三端实时同步靠这些表的 Postgres Change（RLS 同样生效）
--   订单状态 / IM / 通知 / 售后 / 异常 走 Postgres Changes；
--   骑手实时位置不入库，走 Realtime Broadcast 频道 rider:{riderId}（前端订阅）
-- =============================================================================
alter publication supabase_realtime add table
  public.orders, public.order_items, public.messages, public.notifications,
  public.refund_requests, public.delivery_exceptions;

-- =============================================================================
-- 十二、Storage 存储桶（替代前端 base64 图片；三个桶均公开读）
--   avatars      路径 {uid}/xxx.jpg      仅本人可写
--   dish-images  路径 {shopId}/xxx.jpg   仅该店店主可写
--   review-images 路径 {uid}/xxx.jpg     仅本人可写
-- =============================================================================
insert into storage.buckets (id, name, public) values
  ('avatars','avatars',true),
  ('dish-images','dish-images',true),
  ('review-images','review-images',true)
on conflict (id) do nothing;

create policy storage_media_read on storage.objects for select to anon, authenticated
  using (bucket_id in ('avatars','dish-images','review-images'));

create policy storage_avatar_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_avatar_del on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy storage_dish_write on storage.objects for insert to authenticated
  with check (bucket_id = 'dish-images'
    and public.is_shop_owner(((storage.foldername(name))[1])::uuid));
create policy storage_dish_del on storage.objects for delete to authenticated
  using (bucket_id = 'dish-images'
    and public.is_shop_owner(((storage.foldername(name))[1])::uuid));

create policy storage_review_write on storage.objects for insert to authenticated
  with check (bucket_id = 'review-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_review_del on storage.objects for delete to authenticated
  using (bucket_id = 'review-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================================
-- 迁移结束。后续文件：
--   20260915010000_seed_demo.sql  —— 8 家内置演示店、分类菜品、平台券模板
-- =============================================================================



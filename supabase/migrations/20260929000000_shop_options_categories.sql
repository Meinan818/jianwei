-- 商家自定义分类标记；原有分类均为系统分类。
alter table public.categories
  add column if not exists is_custom boolean not null default false;

-- 一次事务替换菜品的规格与加料。任一步失败时，旧配置会整体保留。
create or replace function public.replace_dish_options(
  p_dish_id uuid,
  p_groups jsonb,
  p_extras jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  group_item jsonb;
  option_item jsonb;
  extra_item jsonb;
begin
  if not public.is_dish_owner(p_dish_id) then
    raise exception 'dish owner required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_groups) is distinct from 'array'
     or jsonb_typeof(p_extras) is distinct from 'array'
     or jsonb_array_length(p_groups) > 30
     or jsonb_array_length(p_extras) > 50 then
    raise exception 'invalid dish options' using errcode = '22023';
  end if;

  delete from public.dish_spec_groups where dish_id = p_dish_id;
  delete from public.dish_extras where dish_id = p_dish_id;

  for group_item in select value from jsonb_array_elements(p_groups) loop
    if nullif(trim(group_item->>'name'), '') is null
       or jsonb_typeof(group_item->'options') is distinct from 'array'
       or jsonb_array_length(group_item->'options') > 30 then
      raise exception 'invalid spec group' using errcode = '22023';
    end if;
    insert into public.dish_spec_groups (id, dish_id, name, sort)
    values ((group_item->>'id')::uuid, p_dish_id, trim(group_item->>'name'),
            (group_item->>'sort')::integer);
    for option_item in select value from jsonb_array_elements(group_item->'options') loop
      if nullif(trim(option_item->>'label'), '') is null then
        raise exception 'invalid spec option' using errcode = '22023';
      end if;
      insert into public.dish_spec_options (id, group_id, label, price_delta, sort)
      values ((option_item->>'id')::uuid, (group_item->>'id')::uuid,
              trim(option_item->>'label'), (option_item->>'priceDelta')::numeric,
              (option_item->>'sort')::integer);
    end loop;
  end loop;

  for extra_item in select value from jsonb_array_elements(p_extras) loop
    if nullif(trim(extra_item->>'name'), '') is null then
      raise exception 'invalid extra' using errcode = '22023';
    end if;
    insert into public.dish_extras (id, dish_id, name, price, sort)
    values ((extra_item->>'id')::uuid, p_dish_id, trim(extra_item->>'name'),
            (extra_item->>'price')::numeric, (extra_item->>'sort')::integer);
  end loop;
end;
$$;

revoke all on function public.replace_dish_options(uuid, jsonb, jsonb) from public;
grant execute on function public.replace_dish_options(uuid, jsonb, jsonb) to authenticated;

-- 删除自定义分类时，同一事务删除其菜品；历史订单明细不受影响。
create or replace function public.delete_custom_category(p_category_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  category_shop_id uuid;
begin
  select shop_id into category_shop_id
  from public.categories
  where id = p_category_id and is_custom = true;
  if category_shop_id is null or not public.is_shop_owner(category_shop_id) then
    raise exception 'custom category owner required' using errcode = '42501';
  end if;

  delete from public.dishes where category_id = p_category_id;
  delete from public.categories where id = p_category_id;
end;
$$;

revoke all on function public.delete_custom_category(uuid) from public;
grant execute on function public.delete_custom_category(uuid) to authenticated;

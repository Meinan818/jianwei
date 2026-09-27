# -*- coding: utf-8 -*-
"""
从 v25 源码 src/data/shops.ts / coupon.ts 解析演示数据，生成 Supabase seed SQL。
固定 UUID（可重复执行、on conflict do nothing），保证与前端 mock 逐字一致。
运行：python3 supabase/gen/gen_seed.py > supabase/migrations/20260915010000_seed_demo.sql
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SHOPS_TS = (ROOT / "src/data/shops.ts").read_text(encoding="utf-8")
COUPON_TS = (ROOT / "src/data/coupon.ts").read_text(encoding="utf-8")

img_base = re.search(r"const IMG_BASE = '([^']+)'", SHOPS_TS).group(1)
IMG = dict(re.findall(r"const ([BS]\d) = IMG_BASE \+ '([^']+)'", SHOPS_TS))
def img(token): return img_base + IMG[token]
def q(s):
    if s is None: return "null"
    return "'" + str(s).replace("'", "''") + "'"

# 固定 UUID（合法 UUIDv4 形态，分段便于肉眼辨认）
def uid(group, n):  return f"00000000-0000-4000-8{group:03x}-{n:012d}"
def shop_uid(no):   return uid(0x00, no)
def cat_uid(no):    return uid(0x01, no)   # no = shop*100 + 店内分类序
def dish_uid(no):   return uid(0x02, no)
def group_uid(no):  return uid(0x03, no)
def option_uid(no): return uid(0x04, no)
def extra_uid(no):  return uid(0x05, no)

def strip_str(line): return re.sub(r"'[^']*'", "''", line)

def parse_dish(block):
    flat = " ".join(block.split())
    def g(pat):
        m = re.search(pat, flat); return m.group(1) if m else None
    d = {"no": int(g(r"id: 'd(\d+)'")), "name": g(r"name: '([^']*)'"),
         "desc": g(r"description: '([^']*)'"), "price": float(g(r"price: ([\d.]+)")),
         "image": g(r"image: (S\d)"), "sales": int(g(r"sales: (\d+)")),
         "groups": [], "extras": []}
    sm = re.search(r"specs: \[(.*?)\]\s*\}\s*,?\s*(?:extras|$)", flat)
    if sm:
        for gm in re.finditer(r"\{\s*id: '[^']+', name: '([^']+)', options: \[(.*?)\]\s*\}", sm.group(1)):
            opts = re.findall(r"\{\s*id: '[^']+', label: '([^']+?)'(?:, priceDelta: ([\d.]+))?\s*\}", gm.group(2))
            d["groups"].append({"name": gm.group(1),
                                "options": [(lab, float(delta or 0)) for lab, delta in opts]})
    em = re.search(r"extras: \[(.*?)\]", flat)
    if em:
        d["extras"] = [(b, float(c)) for b, c in re.findall(
            r"\{\s*id: '[^']+', name: '([^']+)', price: ([\d.]+)\s*\}", em.group(1))]
    return d

def parse():
    st = SHOPS_TS.index("export const MOCK_SHOPS")
    lb = SHOPS_TS.index("= [", st) + 2
    body = SHOPS_TS[lb:SHOPS_TS.index("\n]", lb)]  # 只取数组本体，避开后面的 getAllShops
    lines = body.splitlines()
    shops, cur_shop, cur_cat = [], None, None
    i = 0
    while i < len(lines):
        ln = lines[i]
        m = re.match(r"\s*id: '(\d+)',\s*$", ln)
        if m:
            cur_shop = {"no": int(m.group(1)), "cats": [], "promo": None}
            shops.append(cur_shop); i += 1; continue
        m = re.match(r"\s*id: '(\d+)-(\d+)', name: '(.*?)',", ln)
        if m and cur_shop:
            cur_cat = {"no": (int(m.group(1)), int(m.group(2))), "name": m.group(3), "dishes": []}
            cur_shop["cats"].append(cur_cat); i += 1; continue
        if re.search(r"\{\s*id: 'd\d+',", ln):
            block, depth = ln, strip_str(ln).count("{") - strip_str(ln).count("}")
            while depth > 0:
                i += 1; block += "\n" + lines[i]
                depth += strip_str(lines[i]).count("{") - strip_str(lines[i]).count("}")
            cur_cat["dishes"].append(parse_dish(block)); i += 1; continue
        fm = re.match(r"\s*(\w+): (.+?),?\s*$", ln)
        if cur_shop and fm and fm.group(1) in (
            "name","tagline","cover","rating","monthSales","minOrder","deliveryFee","deliveryTime",
            "distance","category","address","phone","description","businessHours","announcement"):
            val = fm.group(2).rstrip(",").strip()
            cur_shop[fm.group(1)] = val.strip("'") if val.startswith("'") else val
        pm = re.search(r"promotion: \{ type: 'fullReduce', thresholds: \[([^\]]*)\], discounts: \[([^\]]*)\], description: '([^']*)'", ln)
        if pm and cur_shop:
            t = [float(x) for x in pm.group(1).split(",") if x.strip()]
            dd = [float(x) for x in pm.group(2).split(",") if x.strip()]
            cur_shop["promo"] = (t, dd, pm.group(3))
        i += 1
    return shops

def parse_coupons():
    start = COUPON_TS.index("MOCK_COUPONS")
    lb = COUPON_TS.index("= [", start) + 2
    body = COUPON_TS[lb:COUPON_TS.index("]", lb)]
    out = []
    for m in re.finditer(r"\{([^{}]*?)\}", body, re.S):
        blk = " ".join(m.group(1).split())
        def g(p):
            mm = re.search(p, blk); return mm.group(1) if mm else None
        out.append({"name": g(r"name: '([^']*)'"), "type": g(r"type: '(\w+)'"),
                    "value": float(g(r"value: ([\d.]+)")), "min": float(g(r"minAmount: ([\d.]+)")),
                    "exp": g(r"expireDate: '([^']*)'"), "scope": g(r"scope: '([^']*)'"),
                    "desc": g(r"description: '([^']*)'")})
    return out

def main():
    shops, coupons = parse(), parse_coupons()
    o = []
    w = o.append
    w("-- 简味点单 · 演示数据 seed（gen_seed.py 从 v25 源码生成，勿手改）")
    w("-- 可重复执行：固定 UUID + on conflict do nothing；执行前须先跑 01_init_schema.sql")
    w("-- 注意：菜品图片沿用妙搭存储相对路径，最终自部署前迁移到 Storage dish-images 桶并 UPDATE")
    w("begin;\n")

    w("-- 三个演示账号（密码均 123456），profile 由 init 的 auth 触发器自动建立")
    demo_users = [
        ("10000000-0000-4000-8000-000000000001","demo-customer@jianwei.app","customer","演示顾客","13800000001"),
        ("10000000-0000-4000-8000-000000000002","demo-merchant@jianwei.app","merchant","演示商家","13800000002"),
        ("10000000-0000-4000-8000-000000000003","demo-rider@jianwei.app","rider","演示骑手小张","13800000003")]
    for uid_, email, role, nick, phone in demo_users:
        app_meta = '{"provider":"email","providers":["email"]}'
        user_meta = f'{{"role":"{role}","nickname":"{nick}","phone":"{phone}"}}'
        ident = f'{{"sub":"{uid_}","email":"{email}"}}'
        w(f"""insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000',{q(uid_)}::uuid,'authenticated','authenticated',{q(email)},crypt('123456',gen_salt('bf')),now(),now(),now(),{q(app_meta)}::jsonb,{q(user_meta)}::jsonb)
on conflict (id) do nothing;
insert into auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values ({q(email)},{q(uid_)}::uuid,{q(ident)}::jsonb,'email',now(),now(),now()) on conflict do nothing;""")
    w("update public.profiles set is_online=true where id='10000000-0000-4000-8000-000000000003'::uuid;\n")

    w("-- 8 家内置演示店（is_demo=true，owner 为空，所有人只读）")
    for s in shops:
        w(f"""insert into public.shops (id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ({q(shop_uid(s['no']))},{q(s['name'])},{q(s['tagline'])},{q(img(s['cover']))},{q(s['category'])},{s['rating']},{s['monthSales']},{s['minOrder']},{s['deliveryFee']},0,{q(s['deliveryTime'])},{q(s['distance'])},{q(s['address'])},{q(s['phone'])},{q(s['description'])},{q(s['businessHours'])},{q(s['announcement'])},true,true)
on conflict (id) do nothing;""")

    dm = "10000000-0000-4000-8000-000000000002"
    w("-- 演示商家自带店（owner=演示商家，用于立刻体验商家端；一账号一店铺）")
    w(f"""insert into public.shops (id,owner_id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ({q(shop_uid(99))},{q(dm)}::uuid,'演示小店','我自己的演示店铺',{q(img('S1'))},'快餐便当',5.0,0,15,3,0,'25-35分钟','1.0km','学校东门美食街','13800000002','用于体验商家端全部功能','09:00 - 21:00','欢迎光临演示小店',true,false)
on conflict (id) do nothing;""")

    gseq = oseq = eseq = 1
    for s in shops:
        for ci, c in enumerate(s["cats"], 1):
            w(f"insert into public.categories (id,shop_id,name,sort) values ({q(cat_uid(s['no']*100+ci))},{q(shop_uid(s['no']))},{q(c['name'])},{ci}) on conflict do nothing;")
            for d in c["dishes"]:
                w(f"""insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ({q(dish_uid(d['no']))},{q(shop_uid(s['no']))},{q(cat_uid(s['no']*100+ci))},{q(d['name'])},{q(d['desc'])},{d['price']},{q(img(d['image']))},{d['sales']},-1,false,true,{d['no']}) on conflict do nothing;""")
                for grp in d["groups"]:
                    gid = group_uid(gseq); gseq += 1
                    w(f"insert into public.dish_spec_groups (id,dish_id,name,sort) values ({q(gid)},{q(dish_uid(d['no']))},{q(grp['name'])},{gseq}) on conflict do nothing;")
                    for oi,(lab,delta) in enumerate(grp["options"],1):
                        pid = option_uid(oseq); oseq += 1
                        w(f"insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ({q(pid)},{q(gid)},{q(lab)},{delta},{oi}) on conflict do nothing;")
                for lab,price in d["extras"]:
                    eid = extra_uid(eseq); eseq += 1
                    w(f"insert into public.dish_extras (id,dish_id,name,price,sort) values ({q(eid)},{q(dish_uid(d['no']))},{q(lab)},{price},{eseq}) on conflict do nothing;")
        if s["promo"]:
            t,dd,desc = s["promo"]
            w(f"""insert into public.shop_activities (id,shop_id,type,name,description,active,thresholds,discounts)
values ({q(uid(0x06,s['no']))},{q(shop_uid(s['no']))},'fullReduce','满减活动',{q(desc)},true,array[{','.join(str(x) for x in t)}],array[{','.join(str(x) for x in dd)}]) on conflict do nothing;""")

    w("-- 演示商家店：2 分类 + 3 菜")
    w(f"""insert into public.categories (id,shop_id,name,sort) values
({q(cat_uid(9901))},{q(shop_uid(99))},'热销',1),
({q(cat_uid(9902))},{q(shop_uid(99))},'套餐',2) on conflict do nothing;""")
    for no,cn,name,desc,price,tok,sales in [
        (901,9901,"招牌牛肉饭","鲜嫩牛肉配时蔬",22,"S1",128),
        (902,9901,"香辣鸡腿饭","秘制鸡腿微辣开胃",20,"S2",96),
        (903,9902,"双拼套餐","两款主菜任选",26,"S3",64)]:
        w(f"""insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ({q(dish_uid(no))},{q(shop_uid(99))},{q(cat_uid(cn))},{q(name)},{q(desc)},{price},{q(img(tok))},{sales},-1,false,true,{no}) on conflict do nothing;""")

    w("-- 领券中心 6 张平台券")
    for i,c in enumerate(coupons,1):
        w(f"""insert into public.coupons (id,name,type,value,min_amount,expire_date,scope,description,active)
values ({q(uid(0x07,i))},{q(c['name'])},{q(c['type'])},{c['value']},{c['min']},{q(c['exp'])},{q(c['scope'])},{q(c['desc'])},true) on conflict do nothing;""")

    w("""
-- 自检：shops=9 / categories=26(行) / dishes=62 / coupons=6
-- select (select count(*) from public.shops) shops,
--        (select count(*) from public.categories) categories,
--        (select count(*) from public.dishes) dishes,
--        (select count(*) from public.coupons) coupons;
commit;""")
    sys.stdout.write("\n".join(o))

if __name__ == "__main__":
    main()

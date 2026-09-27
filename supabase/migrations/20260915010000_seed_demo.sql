-- 简味点单 · 演示数据 seed（gen_seed.py 从 v25 源码生成，勿手改）
-- 可重复执行：固定 UUID + on conflict do nothing；执行前须先跑 01_init_schema.sql
-- 注意：菜品图片沿用妙搭存储相对路径，最终自部署前迁移到 Storage dish-images 桶并 UPDATE
begin;

-- 三个演示账号（密码均 123456），profile 由 init 的 auth 触发器自动建立
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000001'::uuid,'authenticated','authenticated','demo-customer@jianwei.app',crypt('123456',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"role":"customer","nickname":"演示顾客","phone":"13800000001"}'::jsonb)
on conflict (id) do nothing;
insert into auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values ('demo-customer@jianwei.app','10000000-0000-4000-8000-000000000001'::uuid,'{"sub":"10000000-0000-4000-8000-000000000001","email":"demo-customer@jianwei.app"}'::jsonb,'email',now(),now(),now()) on conflict do nothing;
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000002'::uuid,'authenticated','authenticated','demo-merchant@jianwei.app',crypt('123456',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"role":"merchant","nickname":"演示商家","phone":"13800000002"}'::jsonb)
on conflict (id) do nothing;
insert into auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values ('demo-merchant@jianwei.app','10000000-0000-4000-8000-000000000002'::uuid,'{"sub":"10000000-0000-4000-8000-000000000002","email":"demo-merchant@jianwei.app"}'::jsonb,'email',now(),now(),now()) on conflict do nothing;
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000003'::uuid,'authenticated','authenticated','demo-rider@jianwei.app',crypt('123456',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"role":"rider","nickname":"演示骑手小张","phone":"13800000003"}'::jsonb)
on conflict (id) do nothing;
insert into auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
values ('demo-rider@jianwei.app','10000000-0000-4000-8000-000000000003'::uuid,'{"sub":"10000000-0000-4000-8000-000000000003","email":"demo-rider@jianwei.app"}'::jsonb,'email',now(),now(),now()) on conflict do nothing;
update public.profiles set is_online=true where id='10000000-0000-4000-8000-000000000003'::uuid;

-- 8 家内置演示店（is_demo=true，owner 为空，所有人只读）
insert into public.shops (id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ('00000000-0000-4000-8000-000000000001','饭否·品质快餐','精选食材 · 匠心烹制','/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda','快餐便当',4.7,3256,20,3,0,'25-35分钟','0.8km','朝阳区望京SOHO T1 B1层','010-8888-1001','饭否品质快餐坚持每日新鲜采购食材，所有餐品现点现做。我们承诺每一份餐品都经过严格的品质把控，从源头保证食品安全，让每一位顾客吃得放心、吃得满意。','09:00 - 21:00','精选食材，每日新鲜烹制',true,true)
on conflict (id) do nothing;
insert into public.shops (id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ('00000000-0000-4000-8000-000000000002','川味轩','地道川味 · 麻辣鲜香','/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda','中式炒菜',4.8,4521,25,4,0,'30-40分钟','1.3km','朝阳区三里屯太古里南区3层','010-8888-2002','川味轩传承正宗川味，由四川籍大厨掌勺，坚持使用原产地辣椒和花椒，还原最地道的麻辣鲜香。招牌水煮牛肉、毛血旺、酸菜鱼深受食客喜爱。','10:00 - 22:00','地道川味，麻辣鲜香',true,true)
on conflict (id) do nothing;
insert into public.shops (id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ('00000000-0000-4000-8000-000000000003','堡堡王','现点现做 · 新鲜出炉','/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7i7kxaai_ve_miaoda','汉堡披萨',4.5,2876,25,5,0,'20-30分钟','0.6km','朝阳区国贸商城B2层','010-8888-3003','堡堡王坚持手工现做，所有肉饼选用优质牛肉，每日新鲜配送。现烤面包搭配秘制酱料，每一口都是满足。还有多款意式薄底披萨等您品尝。','08:00 - 22:30','现点现做，新鲜出炉',true,true)
on conflict (id) do nothing;
insert into public.shops (id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ('00000000-0000-4000-8000-000000000004','茶颜茶语','手作茶饮 · 每日鲜煮','/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jbsi4eo_ve_miaoda','奶茶饮品',4.9,6234,15,2,0,'15-25分钟','0.4km','朝阳区望京街9号合生汇B1','010-8888-4004','茶颜茶语坚持每日现煮茶汤，精选优质茶叶，手作每一杯好茶。招牌珍珠奶茶Q弹爽口，黑糖波波鲜奶浓郁焦香，还有多款果茶系列等您来尝。','10:00 - 22:00','手作茶饮，每日鲜煮',true,true)
on conflict (id) do nothing;
insert into public.shops (id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ('00000000-0000-4000-8000-000000000005','樱花亭','匠心日料 · 新鲜刺身','/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hb2h6fi_ve_miaoda','日韩料理',4.6,2156,30,5,0,'30-45分钟','1.8km','朝阳区亮马桥外交公寓底商','010-8888-5005','樱花亭是一家专注日式料理的精致餐厅，刺身每日空运到货，确保极致新鲜。主厨拥有15年日料经验，匠心制作每一道菜品，带给您地道的东瀛风味。','11:00 - 22:00','匠心日料，新鲜刺身',true,true)
on conflict (id) do nothing;
insert into public.shops (id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ('00000000-0000-4000-8000-000000000006','串串香','炭火现烤 · 滋滋冒油','/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7obqq6ci_ve_miaoda','烧烤炸串',4.4,5678,20,3,0,'25-35分钟','0.9km','朝阳区望京西园三区东门','010-8888-6006','串串香选用每日新鲜食材，炭火现烤，孜然飘香。招牌羊肉串外焦里嫩，还有多种烤串、炸物供您选择。深夜食堂，温暖每一个夜归人。','11:00 - 24:00','炭火现烤，滋滋冒油',true,true)
on conflict (id) do nothing;
insert into public.shops (id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ('00000000-0000-4000-8000-000000000007','轻食主义','新鲜有机 · 低卡健康','/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hzdnmkg_ve_miaoda','轻食沙拉',4.8,1890,25,4,0,'20-30分钟','1.1km','朝阳区建国路88号SOHO现代城B座','010-8888-7007','轻食主义专注健康饮食，所有食材均选用有机新鲜蔬菜和优质蛋白。我们相信健康饮食不等于乏味，用心搭配每一份轻食，让您吃得健康也吃得开心。','07:00 - 21:00','新鲜有机，低卡健康',true,true)
on conflict (id) do nothing;
insert into public.shops (id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ('00000000-0000-4000-8000-000000000008','面面俱到','手工现做 · 汤鲜面滑','/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7mtzyycq_ve_miaoda','粥粉面点',4.6,3890,15,2,0,'20-30分钟','0.5km','朝阳区呼家楼北街12号','010-8888-8008','面面俱到传承北方面食文化，坚持手工制作每一份面点。汤底慢火熬制8小时以上，面条劲道爽滑。从红烧牛肉面到小笼包，总有一款满足您的味蕾。','06:00 - 22:00','手工现做，汤鲜面滑',true,true)
on conflict (id) do nothing;
-- 演示商家自带店（owner=演示商家，用于立刻体验商家端；一账号一店铺）
insert into public.shops (id,owner_id,name,tagline,cover_url,category,rating,month_sales,min_order,delivery_fee,packing_fee,delivery_time,distance,address,phone,description,business_hours,announcement,is_open,is_demo)
values ('00000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000002'::uuid,'演示小店','我自己的演示店铺','/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda','快餐便当',5.0,0,15,3,0,'25-35分钟','1.0km','学校东门美食街','13800000002','用于体验商家端全部功能','09:00 - 21:00','欢迎光临演示小店',true,false)
on conflict (id) do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000101','00000000-0000-4000-8000-000000000001','热销',1) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000001','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8001-000000000101','红烧肉套餐','精选五花肉配时蔬',28.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',892,-1,false,true,1) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8001-000000000101','宫保鸡丁饭','鸡丁花生经典搭配',25.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda',756,-1,false,true,2) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000003','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8001-000000000101','糖醋里脊盖饭','外酥里嫩酸甜可口',26.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7i7kxaai_ve_miaoda',634,-1,false,true,3) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000102','00000000-0000-4000-8000-000000000001','套餐',2) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000004','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8001-000000000102','两荤一素套餐','任选两荤一素搭配',22.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda',1203,-1,false,true,4) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000005','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8001-000000000102','三荤两素套餐','丰盛搭配实惠之选',32.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',568,-1,false,true,5) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000006','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8001-000000000102','酸菜鱼套餐','鲜嫩鱼片酸辣开胃',35.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7mtzyycq_ve_miaoda',445,-1,false,true,6) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000103','00000000-0000-4000-8000-000000000001','小食饮品',3) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000007','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8001-000000000103','紫菜蛋花汤','清淡鲜美暖胃',6.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7mtzyycq_ve_miaoda',2100,-1,false,true,7) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000008','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8001-000000000103','冰镇柠檬水','清爽解渴',8.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jbsi4eo_ve_miaoda',1876,-1,false,true,8) on conflict do nothing;
insert into public.shop_activities (id,shop_id,type,name,description,active,thresholds,discounts)
values ('00000000-0000-4000-8006-000000000001','00000000-0000-4000-8000-000000000001','fullReduce','满减活动','满25减3，满45减8，满65减15',true,array[25.0,45.0,65.0],array[3.0,8.0,15.0]) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000201','00000000-0000-4000-8000-000000000002','热销',1) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000009','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8001-000000000201','水煮牛肉','麻辣鲜嫩牛肉片',48.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda',1205,-1,false,true,9) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000001','00000000-0000-4000-8002-000000000009','辣度',2) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000001','00000000-0000-4000-8003-000000000001','微辣',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000002','00000000-0000-4000-8003-000000000001','中辣',0.0,2) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000003','00000000-0000-4000-8003-000000000001','特辣',2.0,3) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000001','00000000-0000-4000-8002-000000000009','加粉丝',5.0,2) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000002','00000000-0000-4000-8002-000000000009','加豆皮',4.0,3) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000003','00000000-0000-4000-8002-000000000009','加午餐肉',8.0,4) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000010','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8001-000000000201','辣子鸡丁','干辣椒爆炒鸡肉',38.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',987,-1,false,true,10) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000002','00000000-0000-4000-8002-000000000010','辣度',3) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000004','00000000-0000-4000-8003-000000000002','微辣',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000005','00000000-0000-4000-8003-000000000002','中辣',0.0,2) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000006','00000000-0000-4000-8003-000000000002','特辣',2.0,3) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000011','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8001-000000000201','鱼香肉丝','经典川味酸甜带辣',32.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7i7kxaai_ve_miaoda',856,-1,false,true,11) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000202','00000000-0000-4000-8000-000000000002','招牌硬菜',2) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000012','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8001-000000000202','毛血旺','鸭血毛肚料足味浓',58.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7mtzyycq_ve_miaoda',678,-1,false,true,12) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000003','00000000-0000-4000-8002-000000000012','辣度',4) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000007','00000000-0000-4000-8003-000000000003','微辣',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000008','00000000-0000-4000-8003-000000000003','中辣',0.0,2) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000009','00000000-0000-4000-8003-000000000003','特辣',3.0,3) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000004','00000000-0000-4000-8002-000000000012','加毛肚',12.0,5) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000005','00000000-0000-4000-8002-000000000012','加黄喉',10.0,6) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000006','00000000-0000-4000-8002-000000000012','加午餐肉',8.0,7) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000013','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8001-000000000202','酸菜鱼','鲜嫩鱼片配酸菜',52.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hzdnmkg_ve_miaoda',543,-1,false,true,13) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000007','00000000-0000-4000-8002-000000000013','加鱼片',15.0,8) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000008','00000000-0000-4000-8002-000000000013','加粉丝',5.0,9) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000009','00000000-0000-4000-8002-000000000013','加豆腐',4.0,10) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000014','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8001-000000000202','回锅肉','五花肉蒜苗经典',36.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda',912,-1,false,true,14) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000203','00000000-0000-4000-8000-000000000002','主食',3) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000015','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8001-000000000203','蛋炒饭','粒粒分明蛋香十足',15.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',2340,-1,false,true,15) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000016','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8001-000000000203','担担面','芝麻酱肉末拌面',18.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7mtzyycq_ve_miaoda',1678,-1,false,true,16) on conflict do nothing;
insert into public.shop_activities (id,shop_id,type,name,description,active,thresholds,discounts)
values ('00000000-0000-4000-8006-000000000002','00000000-0000-4000-8000-000000000002','fullReduce','满减活动','满30减5，满60减12，满100减25',true,array[30.0,60.0,100.0],array[5.0,12.0,25.0]) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000301','00000000-0000-4000-8000-000000000003','热销',1) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000017','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8001-000000000301','经典牛肉堡','厚切牛肉饼配芝士',32.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7i7kxaai_ve_miaoda',1654,-1,false,true,17) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000004','00000000-0000-4000-8002-000000000017','份量',5) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000010','00000000-0000-4000-8003-000000000004','单层',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000011','00000000-0000-4000-8003-000000000004','双层',12.0,2) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000010','00000000-0000-4000-8002-000000000017','加芝士',4.0,11) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000011','00000000-0000-4000-8002-000000000017','加培根',6.0,12) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000012','00000000-0000-4000-8002-000000000017','加煎蛋',4.0,13) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000018','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8001-000000000301','双层芝士堡','双层牛肉双重满足',42.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',1230,-1,false,true,18) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000013','00000000-0000-4000-8002-000000000018','加培根',6.0,14) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000014','00000000-0000-4000-8002-000000000018','加煎蛋',4.0,15) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000019','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8001-000000000301','辣味鸡腿堡','香辣鸡腿鲜嫩多汁',28.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda',987,-1,false,true,19) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000005','00000000-0000-4000-8002-000000000019','辣度',6) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000012','00000000-0000-4000-8003-000000000005','微辣',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000013','00000000-0000-4000-8003-000000000005','超辣',1.0,2) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000015','00000000-0000-4000-8002-000000000019','加芝士',4.0,16) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000302','00000000-0000-4000-8000-000000000003','披萨',2) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000020','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8001-000000000302','意式经典披萨','薄底番茄芝士罗勒',48.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7i7kxaai_ve_miaoda',678,-1,false,true,20) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000021','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8001-000000000302','黑椒牛肉披萨','黑椒牛肉彩椒芝士',55.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda',432,-1,false,true,21) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000303','00000000-0000-4000-8000-000000000003','小食饮品',3) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000022','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8001-000000000303','黄金薯条','外酥里嫩金黄酥脆',12.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7obqq6ci_ve_miaoda',3456,-1,false,true,22) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000023','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8001-000000000303','冰镇可乐','经典冰爽',8.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jbsi4eo_ve_miaoda',2890,-1,false,true,23) on conflict do nothing;
insert into public.shop_activities (id,shop_id,type,name,description,active,thresholds,discounts)
values ('00000000-0000-4000-8006-000000000003','00000000-0000-4000-8000-000000000003','fullReduce','满减活动','满30减5，满50减10，满80减18',true,array[30.0,50.0,80.0],array[5.0,10.0,18.0]) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000401','00000000-0000-4000-8000-000000000004','招牌奶茶',1) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000024','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8001-000000000401','经典珍珠奶茶','Q弹珍珠配醇香奶茶',16.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jbsi4eo_ve_miaoda',3245,-1,false,true,24) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000006','00000000-0000-4000-8002-000000000024','甜度',7) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000014','00000000-0000-4000-8003-000000000006','无糖',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000015','00000000-0000-4000-8003-000000000006','三分糖',0.0,2) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000016','00000000-0000-4000-8003-000000000006','五分糖',0.0,3) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000017','00000000-0000-4000-8003-000000000006','七分糖',0.0,4) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000018','00000000-0000-4000-8003-000000000006','全糖',0.0,5) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000007','00000000-0000-4000-8002-000000000024','冰度',8) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000019','00000000-0000-4000-8003-000000000007','热',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000020','00000000-0000-4000-8003-000000000007','去冰',0.0,2) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000021','00000000-0000-4000-8003-000000000007','少冰',0.0,3) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000022','00000000-0000-4000-8003-000000000007','正常冰',0.0,4) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000008','00000000-0000-4000-8002-000000000024','杯型',9) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000023','00000000-0000-4000-8003-000000000008','中杯',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000024','00000000-0000-4000-8003-000000000008','大杯',4.0,2) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000016','00000000-0000-4000-8002-000000000024','加珍珠',3.0,17) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000017','00000000-0000-4000-8002-000000000024','加椰果',3.0,18) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000018','00000000-0000-4000-8002-000000000024','加布丁',4.0,19) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000025','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8001-000000000401','黑糖波波鲜奶','手炒黑糖浓郁焦香',22.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda',2876,-1,false,true,25) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000009','00000000-0000-4000-8002-000000000025','甜度',10) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000025','00000000-0000-4000-8003-000000000009','无糖',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000026','00000000-0000-4000-8003-000000000009','三分糖',0.0,2) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000027','00000000-0000-4000-8003-000000000009','五分糖',0.0,3) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000028','00000000-0000-4000-8003-000000000009','七分糖',0.0,4) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000010','00000000-0000-4000-8002-000000000025','冰度',11) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000029','00000000-0000-4000-8003-000000000010','热',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000030','00000000-0000-4000-8003-000000000010','去冰',0.0,2) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000031','00000000-0000-4000-8003-000000000010','少冰',0.0,3) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000032','00000000-0000-4000-8003-000000000010','正常冰',0.0,4) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000011','00000000-0000-4000-8002-000000000025','杯型',12) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000033','00000000-0000-4000-8003-000000000011','中杯',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000034','00000000-0000-4000-8003-000000000011','大杯',5.0,2) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000019','00000000-0000-4000-8002-000000000025','加珍珠',3.0,20) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000020','00000000-0000-4000-8002-000000000025','加布丁',4.0,21) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000026','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8001-000000000401','芋泥啵啵奶茶','绵密芋泥香甜可口',20.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',2134,-1,false,true,26) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000012','00000000-0000-4000-8002-000000000026','甜度',13) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000035','00000000-0000-4000-8003-000000000012','三分糖',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000036','00000000-0000-4000-8003-000000000012','五分糖',0.0,2) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000037','00000000-0000-4000-8003-000000000012','七分糖',0.0,3) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000038','00000000-0000-4000-8003-000000000012','全糖',0.0,4) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000013','00000000-0000-4000-8002-000000000026','冰度',14) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000039','00000000-0000-4000-8003-000000000013','热',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000040','00000000-0000-4000-8003-000000000013','去冰',0.0,2) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000041','00000000-0000-4000-8003-000000000013','少冰',0.0,3) on conflict do nothing;
insert into public.dish_spec_groups (id,dish_id,name,sort) values ('00000000-0000-4000-8003-000000000014','00000000-0000-4000-8002-000000000026','杯型',15) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000042','00000000-0000-4000-8003-000000000014','中杯',0.0,1) on conflict do nothing;
insert into public.dish_spec_options (id,group_id,label,price_delta,sort) values ('00000000-0000-4000-8004-000000000043','00000000-0000-4000-8003-000000000014','大杯',4.0,2) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000021','00000000-0000-4000-8002-000000000026','加芋泥',5.0,22) on conflict do nothing;
insert into public.dish_extras (id,dish_id,name,price,sort) values ('00000000-0000-4000-8005-000000000022','00000000-0000-4000-8002-000000000026','加椰果',3.0,23) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000402','00000000-0000-4000-8000-000000000004','果茶系列',2) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000027','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8001-000000000402','满杯西柚','鲜切西柚清爽解腻',18.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hzdnmkg_ve_miaoda',1890,-1,false,true,27) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000028','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8001-000000000402','柠檬绿茶','清新柠檬搭配绿茶',14.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jbsi4eo_ve_miaoda',2345,-1,false,true,28) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000029','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8001-000000000402','百香果双响炮','百香果椰果双重口感',20.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7i7kxaai_ve_miaoda',1678,-1,false,true,29) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000403','00000000-0000-4000-8000-000000000004','纯茶',3) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000030','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8001-000000000403','高山乌龙','清雅花香回甘悠长',12.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jbsi4eo_ve_miaoda',890,-1,false,true,30) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000031','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8001-000000000403','茉莉绿茶','花香四溢清新淡雅',10.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hzdnmkg_ve_miaoda',1203,-1,false,true,31) on conflict do nothing;
insert into public.shop_activities (id,shop_id,type,name,description,active,thresholds,discounts)
values ('00000000-0000-4000-8006-000000000004','00000000-0000-4000-8000-000000000004','fullReduce','满减活动','满20减2，满35减5，满50减8',true,array[20.0,35.0,50.0],array[2.0,5.0,8.0]) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000501','00000000-0000-4000-8000-000000000005','热销',1) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000032','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8001-000000000501','三文鱼刺身','新鲜厚切三文鱼',58.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hb2h6fi_ve_miaoda',678,-1,false,true,32) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000033','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8001-000000000501','鳗鱼饭','蒲烧鳗鱼配米饭',48.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',543,-1,false,true,33) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000034','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8001-000000000501','豚骨拉面','浓郁骨汤弹牙拉面',35.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7mtzyycq_ve_miaoda',890,-1,false,true,34) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000502','00000000-0000-4000-8000-000000000005','寿司',2) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000035','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8001-000000000502','综合寿司拼盘','八种经典手握寿司',68.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hb2h6fi_ve_miaoda',432,-1,false,true,35) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000036','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8001-000000000502','加州卷','牛油果蟹棒经典',38.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hzdnmkg_ve_miaoda',356,-1,false,true,36) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000503','00000000-0000-4000-8000-000000000005','小食',3) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000037','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8001-000000000503','日式煎饺','薄皮馅多外酥里嫩',22.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7obqq6ci_ve_miaoda',567,-1,false,true,37) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000038','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8001-000000000503','味噌汤','豆腐海带经典暖汤',10.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7mtzyycq_ve_miaoda',890,-1,false,true,38) on conflict do nothing;
insert into public.shop_activities (id,shop_id,type,name,description,active,thresholds,discounts)
values ('00000000-0000-4000-8006-000000000005','00000000-0000-4000-8000-000000000005','fullReduce','满减活动','满50减8，满80减15，满120减28',true,array[50.0,80.0,120.0],array[8.0,15.0,28.0]) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000601','00000000-0000-4000-8000-000000000006','烤串',1) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000039','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8001-000000000601','羊肉串(10串)','炭烤羊肉串孜然飘香',30.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7obqq6ci_ve_miaoda',2345,-1,false,true,39) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000040','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8001-000000000601','牛肉串(10串)','精选牛肉嫩滑多汁',35.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda',1876,-1,false,true,40) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000041','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8001-000000000601','烤鸡翅(5只)','蜜汁奥尔良风味',25.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7i7kxaai_ve_miaoda',1567,-1,false,true,41) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000602','00000000-0000-4000-8000-000000000006','炸物',2) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000042','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8001-000000000602','炸鸡排','台式大鸡排香酥脆',18.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7obqq6ci_ve_miaoda',3210,-1,false,true,42) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000043','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8001-000000000602','薯条拼盘','粗薯配番茄酱',15.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hzdnmkg_ve_miaoda',2890,-1,false,true,43) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000603','00000000-0000-4000-8000-000000000006','主食',3) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000044','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8001-000000000603','烤馒头片','外酥里软奶香十足',8.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',1890,-1,false,true,44) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000045','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8001-000000000603','蛋炒方便面','夜市经典炒面',12.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7mtzyycq_ve_miaoda',2345,-1,false,true,45) on conflict do nothing;
insert into public.shop_activities (id,shop_id,type,name,description,active,thresholds,discounts)
values ('00000000-0000-4000-8006-000000000006','00000000-0000-4000-8000-000000000006','fullReduce','满减活动','满30减3，满50减8，满80减16',true,array[30.0,50.0,80.0],array[3.0,8.0,16.0]) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000701','00000000-0000-4000-8000-000000000007','沙拉碗',1) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000046','00000000-0000-4000-8000-000000000007','00000000-0000-4000-8001-000000000701','凯撒沙拉','罗马生菜帕玛森芝士',32.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hzdnmkg_ve_miaoda',678,-1,false,true,46) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000047','00000000-0000-4000-8000-000000000007','00000000-0000-4000-8001-000000000701','牛油果藜麦沙拉','牛油果藜麦坚果',38.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',543,-1,false,true,47) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000048','00000000-0000-4000-8000-000000000007','00000000-0000-4000-8001-000000000701','烟熏三文鱼沙拉','三文鱼配芝麻菜',45.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hb2h6fi_ve_miaoda',345,-1,false,true,48) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000702','00000000-0000-4000-8000-000000000007','三明治',2) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000049','00000000-0000-4000-8000-000000000007','00000000-0000-4000-8001-000000000702','全麦鸡胸三明治','鸡胸肉生菜全麦面包',28.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7i7kxaai_ve_miaoda',456,-1,false,true,49) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000050','00000000-0000-4000-8000-000000000007','00000000-0000-4000-8001-000000000702','牛油果鸡蛋三明治','牛油果太阳蛋组合',32.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hzdnmkg_ve_miaoda',389,-1,false,true,50) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000703','00000000-0000-4000-8000-000000000007','鲜榨果汁',3) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000051','00000000-0000-4000-8000-000000000007','00000000-0000-4000-8001-000000000703','鲜榨橙汁','现榨柳橙无添加',18.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jbsi4eo_ve_miaoda',890,-1,false,true,51) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000052','00000000-0000-4000-8000-000000000007','00000000-0000-4000-8001-000000000703','青瓜雪梨汁','清爽排毒瘦身',22.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jbsi4eo_ve_miaoda',567,-1,false,true,52) on conflict do nothing;
insert into public.shop_activities (id,shop_id,type,name,description,active,thresholds,discounts)
values ('00000000-0000-4000-8006-000000000007','00000000-0000-4000-8000-000000000007','fullReduce','满减活动','满35减5，满55减10，满85减18',true,array[35.0,55.0,85.0],array[5.0,10.0,18.0]) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000801','00000000-0000-4000-8000-000000000008','汤面',1) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000053','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8001-000000000801','红烧牛肉面','大块牛腩浓郁汤底',28.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7mtzyycq_ve_miaoda',1890,-1,false,true,53) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000054','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8001-000000000801','酸辣粉','红油酸辣红薯粉',16.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda',2345,-1,false,true,54) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000055','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8001-000000000801','鲜虾云吞面','大颗鲜虾云吞竹升面',32.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',1567,-1,false,true,55) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000802','00000000-0000-4000-8000-000000000008','拌面',2) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000056','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8001-000000000802','炸酱面','京味肉酱黄瓜丝',18.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7mtzyycq_ve_miaoda',2123,-1,false,true,56) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000057','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8001-000000000802','葱油拌面','葱香四溢简约经典',14.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7obqq6ci_ve_miaoda',1890,-1,false,true,57) on conflict do nothing;
insert into public.categories (id,shop_id,name,sort) values ('00000000-0000-4000-8001-000000000803','00000000-0000-4000-8000-000000000008','蒸点',3) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000058','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8001-000000000803','鲜肉小笼包(8只)','薄皮多汁轻轻一咬',22.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7i7kxaai_ve_miaoda',2678,-1,false,true,58) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000059','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8001-000000000803','虾饺皇(4只)','晶莹剔透虾肉饱满',28.0,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7hb2h6fi_ve_miaoda',1456,-1,false,true,59) on conflict do nothing;
insert into public.shop_activities (id,shop_id,type,name,description,active,thresholds,discounts)
values ('00000000-0000-4000-8006-000000000008','00000000-0000-4000-8000-000000000008','fullReduce','满减活动','满25减3，满40减7，满60减12',true,array[25.0,40.0,60.0],array[3.0,7.0,12.0]) on conflict do nothing;
-- 演示商家店：2 分类 + 3 菜
insert into public.categories (id,shop_id,name,sort) values
('00000000-0000-4000-8001-000000009901','00000000-0000-4000-8000-000000000099','热销',1),
('00000000-0000-4000-8001-000000009902','00000000-0000-4000-8000-000000000099','套餐',2) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000901','00000000-0000-4000-8000-000000000099','00000000-0000-4000-8001-000000009901','招牌牛肉饭','鲜嫩牛肉配时蔬',22,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7jqokigq_ve_miaoda',128,-1,false,true,901) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000902','00000000-0000-4000-8000-000000000099','00000000-0000-4000-8001-000000009901','香辣鸡腿饭','秘制鸡腿微辣开胃',20,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7gylnoai_ve_miaoda',96,-1,false,true,902) on conflict do nothing;
insert into public.dishes (id,shop_id,category_id,name,description,price,image_url,sales,stock,sold_out,on_shelf,sort)
values ('00000000-0000-4000-8002-000000000903','00000000-0000-4000-8000-000000000099','00000000-0000-4000-8001-000000009902','双拼套餐','两款主菜任选',26,'/spark/app/app_17e3cusmabh/runtime/api/v1/storage/object/bucket_aadku6yg5emdg_static/static%2Faadku7i7kxaai_ve_miaoda',64,-1,false,true,903) on conflict do nothing;
-- 领券中心 6 张平台券
insert into public.coupons (id,name,type,value,min_amount,expire_date,scope,description,active)
values ('00000000-0000-4000-8007-000000000001','新人专享券','noThreshold',5.0,0.0,'2026-12-31','全场通用','新用户专享，无门槛立减 5 元',true) on conflict do nothing;
insert into public.coupons (id,name,type,value,min_amount,expire_date,scope,description,active)
values ('00000000-0000-4000-8007-000000000002','满 25 减 5','fullReduce',5.0,25.0,'2026-12-31','全场通用','单笔订单满 25 元可用',true) on conflict do nothing;
insert into public.coupons (id,name,type,value,min_amount,expire_date,scope,description,active)
values ('00000000-0000-4000-8007-000000000003','满 45 减 10','fullReduce',10.0,45.0,'2026-12-31','全场通用','单笔订单满 45 元可用',true) on conflict do nothing;
insert into public.coupons (id,name,type,value,min_amount,expire_date,scope,description,active)
values ('00000000-0000-4000-8007-000000000004','满 60 减 15','fullReduce',15.0,60.0,'2026-12-31','全场通用','单笔订单满 60 元可用',true) on conflict do nothing;
insert into public.coupons (id,name,type,value,min_amount,expire_date,scope,description,active)
values ('00000000-0000-4000-8007-000000000005','8 折优惠券','discount',0.8,30.0,'2026-12-31','全场通用，最高减 20 元','单笔订单满 30 元享 8 折，最高优惠 20 元',true) on conflict do nothing;
insert into public.coupons (id,name,type,value,min_amount,expire_date,scope,description,active)
values ('00000000-0000-4000-8007-000000000006','无门槛 3 元券','noThreshold',3.0,0.0,'2026-12-31','全场通用','无门槛立减 3 元',true) on conflict do nothing;

-- 自检：shops=9 / categories=26(行) / dishes=62 / coupons=6
-- select (select count(*) from public.shops) shops,
--        (select count(*) from public.categories) categories,
--        (select count(*) from public.dishes) dishes,
--        (select count(*) from public.coupons) coupons;
commit;

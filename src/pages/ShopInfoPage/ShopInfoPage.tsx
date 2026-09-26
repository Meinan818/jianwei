import { motion } from 'framer-motion'
import {
  ArrowLeft, Clock, MapPin, Phone, Star, Shield, Award, FileText,
  ChevronRight, BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { toast } from 'sonner'
import { getAllShops, type IShop } from '@/data/shops'
import { useShopStatus } from '@/hooks/useShopStatus'
import CallModal from '@/components/CallModal'
import { useNavigatePush, useNavigateReplace, usePageBack } from '@/hooks/useNavigationStack'
import { Image } from '@/components/ui/image';

/**
 * 店铺信息页：店铺介绍、公告、营业时间、地址、配送信息、资质、评分月售
 */
export default function ShopInfoPage() {
  const { shopId = '' } = useParams()
  const navigatePush = useNavigatePush()
  const navigateReplace = useNavigateReplace()
  const pageBack = usePageBack()
  const [showCall, setShowCall] = useState(false)

  const shop = getAllShops().find(s => s.id === shopId)
  const { shopStatus } = useShopStatus()
  const status = shopStatus[shopId || '']

  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh gap-3">
        <p className="text-muted-foreground text-sm">店铺不存在</p>
        <Button size="sm" onClick={() => navigateReplace('/customer')}>返回首页</Button>
      </div>
    )
  }

  const statusAnnouncement = status?.announcement

  const qualityItems = [
    { icon: Shield, label: '食品安全', desc: '食材安全溯源' },
    { icon: Award, label: '品质联盟', desc: '优质商家认证' },
    { icon: FileText, label: '营业执照', desc: '资质齐全' },
  ]

  const handleChat = () => {
    navigatePush(`/chat?type=shop&shopId=${shop.id}&shopName=${encodeURIComponent(shop.name)}&peerRole=merchant`)
  }

  return (
    <div className="flex flex-col h-dvh bg-muted/20">
      {/* 顶部导航 */}
      <div className="flex items-center h-12 px-3 bg-card/95 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="size-8" onClick={pageBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="flex-1 text-center text-sm font-medium">商家信息</h1>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 店铺头图 */}
        <div className="relative h-40 w-full bg-muted">
          <Image src={shop.cover} alt={shop.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="size-4" />
              <span className="text-base font-bold">{shop.name}</span>
            </div>
            <div className="text-xs opacity-80 mt-1">{shop.tagline}</div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* 评分与月售 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border/50 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="flex items-center gap-1">
                    <Star className="size-4 fill-foreground text-foreground" />
                    <span className="text-lg font-bold text-foreground">{shop.rating}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">店铺评分</div>
                </div>
                <div className="w-px h-8 bg-border/50" />
                <div className="text-center">
                  <div className="text-lg font-bold text-foreground">月售{shop.monthSales}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">月销量</div>
                </div>
                <div className="w-px h-8 bg-border/50" />
                <div className="text-center">
                  <div className="text-lg font-bold text-foreground">{shop.deliveryTime}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">配送时长</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 配送信息 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card rounded-xl border border-border/50 p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">配送信息</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="size-4 text-foreground/70 shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground">{shop.address}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">距离 {shop.distance} km</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="size-4 text-foreground/70 shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground">{shop.deliveryTime} 分钟</p>
                  <p className="text-xs text-muted-foreground mt-0.5">预计配送</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-foreground/70 shrink-0">¥</span>
                <div>
                  <p className="text-foreground">起送 ¥{shop.minOrder}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">配送费 ¥{shop.deliveryFee}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="size-4 text-foreground/70 shrink-0 mt-0.5" />
                <div>
                  <button onClick={() => setShowCall(true)} className="text-foreground hover:underline">
                    {shop.phone || '400-888-1234'}
                  </button>
                  <p className="text-xs text-muted-foreground mt-0.5">点击拨打</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 商家公告 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border/50 p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-2">商家公告</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
               {statusAnnouncement || shop.announcement || '欢迎光临本店，食材新鲜，品质保证。'}
            </p>
          </motion.div>

          {/* 店铺介绍 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card rounded-xl border border-border/50 p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-2">店铺介绍</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {shop.description || `${shop.name} 精选优质食材，坚持传统工艺与现代创新相结合。我们承诺每一份餐品都经过严格的品质把控，为您带来安心、美味的用餐体验。`}
            </p>
          </motion.div>

          {/* 营业时间 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border border-border/50 p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="size-4" />
              营业时间
            </h3>
            <div className="text-sm text-foreground">
              {status?.isOpen ?? true ? (
                <span className="text-success font-medium">营业中</span>
              ) : (
                <span className="text-muted-foreground font-medium">休息中</span>
              )}
              <span className="text-muted-foreground ml-2">
                {shop.businessHours || '09:00 - 22:00'}
              </span>
            </div>
          </motion.div>

          {/* 资质信息 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card rounded-xl border border-border/50 p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">商家资质</h3>
            <div className="grid grid-cols-3 gap-2">
              {qualityItems.map(item => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex flex-col items-center gap-1.5 p-3 bg-muted/50 rounded-lg">
                    <Icon className="size-5 text-foreground/70" />
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* 联系商家 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl border border-border/50 overflow-hidden"
          >
            <button
              onClick={handleChat}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border/30 text-left active:bg-muted/50"
            >
              <span className="text-sm text-foreground flex-1">在线咨询</span>
              <span className="text-xs text-muted-foreground">随时联系商家</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowCall(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted/50"
            >
              <span className="text-sm text-foreground flex-1">拨打电话</span>
              <span className="text-xs text-muted-foreground">{shop.phone || '400-888-1234'}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          </motion.div>

          <div className="h-6" />
        </div>
      </div>

      <CallModal
        open={showCall}
        peerName={shop.name}
        peerAvatar={shop.cover}
        peerRole="merchant"
        peerPhone={shop.phone}
        onClose={() => setShowCall(false)}
      />
    </div>
  )
}

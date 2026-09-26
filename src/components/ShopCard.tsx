import { motion } from 'framer-motion'
import { Star, Clock, Bike, Tag, Moon } from 'lucide-react'
import { Image } from '@/components/ui/image'
import { useShopStatus } from '@/hooks/useShopStatus'
import { useNavigatePush } from '@/hooks/useNavigationStack'
import type { IShop } from '@/data/shops'

interface ShopCardProps {
  shop: IShop
  index?: number
}

export default function ShopCard({ shop, index = 0 }: ShopCardProps) {
  const navigatePush = useNavigatePush()
  const { isShopOpen, getShopStatus } = useShopStatus()
  const open = isShopOpen(shop.id)
  const status = getShopStatus(shop.id)
  const monthSales = status?.monthSales ?? shop.monthSales

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigatePush(`/customer/shop/${shop.id}`)}
      className="bg-card rounded-xl overflow-hidden border border-border/60 active:shadow-sm cursor-pointer relative"
    >
      <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted">
        <Image
          src={shop.cover}
          alt={shop.name}
          className={`w-full h-full object-cover transition-all ${!open ? 'grayscale opacity-60' : ''}`}
        />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent" />
        {!open && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background/90 rounded-full">
              <Moon className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">商家休息中</span>
            </div>
          </div>
        )}
        {shop.promotion && open && (
          <div className="absolute left-2 bottom-2 flex items-center gap-1 px-1.5 py-0.5 bg-foreground/90 text-background text-[10px] font-medium rounded">
            <Tag className="size-3" />
            <span>{shop.promotion.description.split('，')[0]}</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <h3 className="font-semibold text-sm text-foreground truncate">{shop.name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-0.5">
            <Star className="size-3 fill-foreground text-foreground" />
            <span className="text-foreground font-medium">{shop.rating}</span>
          </div>
          <span>·</span>
          <span>月售 {monthSales}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Bike className="size-3" />
            <span>{shop.deliveryFee === 0 ? '免配送' : `配送费¥${shop.deliveryFee}`}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="size-3" />
            <span>{shop.deliveryTime}</span>
          </div>
          <span>{shop.distance}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          起送 ¥{shop.minOrder}
        </div>
      </div>
    </motion.div>
  )
}

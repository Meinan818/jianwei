import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, Plus, Minus, Edit3, Check, X,
  ChevronDown, Eye, EyeOff, Tag, Camera, Image as ImageIcon,
  Settings2, Trash2, ChevronRight, Layers,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useShopStatus } from '@/hooks/useShopStatus'
import { useNavigatePush } from '@/hooks/useNavigationStack'
import { getAllShops } from '@/data/shops'
import { Image } from '@/components/ui/image'
import { toast } from 'sonner'

// 压缩图片并返回 base64（复用头像上传逻辑）
async function compressImage(file: File, maxSize = 400, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        } else if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(''); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

interface DishWithOverride {
  id: string
  name: string
  description: string
  price: number
  image: string
  status: {
    price: number
    soldOut: boolean
    onShelf: boolean
    stock: number
    image?: string
    name?: string
    description?: string
  }
  isCustom?: boolean
  categoryId?: string
}

export default function MerchantDishesPage() {
  const { user } = useAuth()
  const navigatePush = useNavigatePush()
  const {
    shopStatus, toggleDishShelf, toggleDishSoldOut,
    setDishPrice, setDishStock, setDishImage, setDishInfo, addDish,
    addCategory, renameCategory, deleteCategory, getAllCategories,
    setDishSpecs, setDishExtras,
  } = useShopStatus()

  const shopId = user.shopId || '1'
  const shop = getAllShops().find(s => s.id === shopId)
  const status = shopStatus[shopId]

  const [activeCategory, setActiveCategory] = useState(shop?.categories[0]?.id || '')
  const [editingDish, setEditingDish] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editStock, setEditStock] = useState('')
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addImage, setAddImage] = useState('')
  const [addCategoryId, setAddCategoryId] = useState('')
  const [showCatManager, setShowCatManager] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')
  // 规格编辑弹层
  const [specDishId, setSpecDishId] = useState<string | null>(null)
  const [specTab, setSpecTab] = useState<'specs' | 'extras'>('specs')
  // 规格组编辑
  const [specGroups, setSpecGroups] = useState<{ id: string; name: string; options: { id: string; label: string; priceDelta: number }[] }[]>([])
  const [extras, setExtras] = useState<{ id: string; name: string; price: number }[]>([])
  // 新增规格/加料的临时输入
  const [newSpecName, setNewSpecName] = useState('')
  const [newSpecOptions, setNewSpecOptions] = useState('')
  const [newExtraName, setNewExtraName] = useState('')
  const [newExtraPrice, setNewExtraPrice] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addFileInputRef = useRef<HTMLInputElement>(null)

  // 整合后的菜品列表（含自定义菜品）
  const getDishesForCategory = (categoryId: string): DishWithOverride[] => {
    if (!shop) return []
    const cat = shop.categories.find(c => c.id === categoryId)
    const base: DishWithOverride[] = (cat?.dishes || []).map(d => {
      const ds = status?.dishes[d.id] || { price: d.price, soldOut: false, onShelf: true, stock: -1 }
      return {
        id: d.id,
        name: d.name,
        description: d.description,
        price: d.price,
        image: d.image,
        status: ds,
      }
    })
    // 追加自定义菜品
    if (status?.dishes) {
      Object.entries(status.dishes).forEach(([dishId, ds]) => {
        if (ds.categoryId === categoryId) {
          base.push({
            id: dishId,
            name: ds.name || '自定义菜品',
            description: ds.description || '',
            price: ds.price,
            image: ds.image || '',
            status: ds,
            isCustom: true,
            categoryId,
          })
        }
      })
    }
    return base
  }

  const currentCategoryDishes = getDishesForCategory(activeCategory)

  const handleStartEdit = (dish: DishWithOverride) => {
    setEditingDish(dish.id)
    setEditPrice(dish.status.price.toString())
    setEditStock(dish.status.stock === -1 ? '' : dish.status.stock.toString())
    setEditName(dish.name)
    setEditDesc(dish.description)
  }

  const openSpecEditor = (dish: DishWithOverride) => {
    setSpecDishId(dish.id)
    setSpecTab('specs')
    // 载入当前规格/加料（优先取覆盖，否则取原菜品）
    const baseDish = shop?.categories.flatMap(c => c.dishes).find(d => d.id === dish.id)
    const override = status?.dishes[dish.id]
    if (override?.specs) {
      setSpecGroups(override.specs.map(s => ({
        id: s.id,
        name: s.name,
        options: s.options.map(o => ({ id: o.id, label: o.label, priceDelta: o.priceDelta || 0 }))
      })))
    } else if (baseDish?.specs) {
      setSpecGroups(baseDish.specs.map(s => ({
        id: s.id,
        name: s.name,
        options: s.options.map(o => ({ id: o.id, label: o.label, priceDelta: o.priceDelta || 0 }))
      })))
    } else {
      setSpecGroups([])
    }
    if (override?.extras) {
      setExtras(override.extras.map(e => ({ id: e.id, name: e.name, price: e.price })))
    } else if (baseDish?.extras) {
      setExtras(baseDish.extras.map(e => ({ id: e.id, name: e.name, price: e.price })))
    } else {
      setExtras([])
    }
  }

  const handleAddSpecGroup = () => {
    if (!newSpecName.trim()) {
      toast.info('请输入规格组名称')
      return
    }
    const options = newSpecOptions.split(/[,，、\s]+/).filter(Boolean).map((label, i) => ({
      id: `opt_${Date.now()}_${i}`,
      label: label.trim(),
      priceDelta: 0,
    }))
    if (options.length === 0) {
      toast.info('请至少输入一个选项')
      return
    }
    const group = {
      id: `spec_${Date.now()}`,
      name: newSpecName.trim(),
      options,
    }
    setSpecGroups(prev => [...prev, group])
    setNewSpecName('')
    setNewSpecOptions('')
  }

  const handleDeleteSpecGroup = (id: string) => {
    setSpecGroups(prev => prev.filter(g => g.id !== id))
  }

  const handleAddExtra = () => {
    if (!newExtraName.trim()) {
      toast.info('请输入加料名称')
      return
    }
    const price = parseFloat(newExtraPrice) || 0
    const extra = { id: `extra_${Date.now()}`, name: newExtraName.trim(), price }
    setExtras(prev => [...prev, extra])
    setNewExtraName('')
    setNewExtraPrice('')
  }

  const handleDeleteExtra = (id: string) => {
    setExtras(prev => prev.filter(e => e.id !== id))
  }

  const handleSaveSpecs = () => {
    if (!specDishId) return
    if (specGroups.length > 0) {
      setDishSpecs(shopId, specDishId, specGroups.map(g => ({
        id: g.id,
        name: g.name,
        options: g.options.map(o => ({ id: o.id, label: o.label, priceDelta: o.priceDelta })),
      })))
    }
    if (extras.length > 0) {
      setDishExtras(shopId, specDishId, extras.map(e => ({ id: e.id, name: e.name, price: e.price })))
    }
    toast.success('规格与加料已保存')
    setSpecDishId(null)
  }

  const handleSaveEdit = (dishId: string) => {
    const price = parseFloat(editPrice)
    if (isNaN(price) || price <= 0) {
      toast.info('请输入有效价格')
      return
    }
    setDishPrice(shopId, dishId, price)
    setDishInfo(shopId, dishId, { name: editName.trim() || undefined, description: editDesc.trim() || undefined })
    const stock = editStock === '' ? -1 : parseInt(editStock)
    if (!isNaN(stock) && stock >= -1) {
      setDishStock(shopId, dishId, stock)
    }
    toast.success('保存成功')
    setEditingDish(null)
  }

  const handlePickImage = (dishId: string) => {
    fileInputRef.current?.click()
    // 存在 state 里，等 onchange 处理
    ;(fileInputRef.current as any).dataset.dishId = dishId
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dishId = (e.target as any).dataset.dishId
    try {
      const b64 = await compressImage(file)
      if (dishId) {
        setDishImage(shopId, dishId, b64)
        toast.success('图片已更新')
      }
    } catch {
      toast.error('图片处理失败')
    }
    e.target.value = ''
  }

  const handleAddFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const b64 = await compressImage(file)
      setAddImage(b64)
    } catch {
      toast.error('图片处理失败')
    }
    e.target.value = ''
  }

  const handleAddDish = () => {
    if (!addName.trim()) {
      toast.info('请输入菜品名称')
      return
    }
    const price = parseFloat(addPrice)
    if (isNaN(price) || price <= 0) {
      toast.info('请输入有效价格')
      return
    }
    addDish(shopId, addCategoryId || activeCategory, {
      name: addName.trim(),
      description: addDesc.trim(),
      price,
      image: addImage,
    })
    toast.success('菜品已添加')
    setShowAddModal(false)
    setAddName('')
    setAddDesc('')
    setAddPrice('')
    setAddImage('')
    setAddCategoryId('')
  }

  const getDisplayImage = (dish: DishWithOverride) => {
    return dish.status.image || dish.image
  }

  if (!shop) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        店铺数据加载中...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 */}
      <motion.div
        initial={{ opacity: 0.98, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 pt-3 pb-2 bg-background/85 backdrop-blur-xl border-b border-border/30 flex items-center justify-between"
      >
        <div>
          <h1 className="text-lg font-semibold text-foreground">商品管理</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            共 {shop.categories.reduce((s, c) => s + c.dishes.length, 0)} 道菜品
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="h-8 px-3 rounded-full bg-foreground text-background text-xs font-medium flex items-center gap-1"
        >
          <Plus className="size-3.5" />
          新增
        </button>
      </motion.div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧分类 */}
        <div className="w-24 flex-shrink-0 overflow-y-auto bg-muted/30 border-r border-border/30 pb-20">
          {getAllCategories(shopId).map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`relative w-full py-3 text-xs text-center transition-colors ${
                activeCategory === cat.id
                  ? 'bg-card text-foreground font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              <span className="block truncate px-1">{cat.name}</span>
              {cat.isCustom && activeCategory === cat.id && (
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">自定义</span>
              )}
            </button>
          ))}
          <button
            onClick={() => setShowCatManager(true)}
            className="w-full py-3 text-xs text-center text-foreground/60 border-t border-border/30 flex items-center justify-center gap-1"
          >
            <Settings2 className="size-3" />
            管理分类
          </button>
        </div>

        {/* 右侧菜品列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="space-y-3">
              {currentCategoryDishes.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  该分类暂无菜品
                </div>
              ) : (
                currentCategoryDishes.map((dish) => {
                  const isEditing = editingDish === dish.id
                  const displayPrice = dish.status.price || dish.price
                  const isOff = !dish.status.onShelf || dish.status.soldOut
                  const displayImg = getDisplayImage(dish)

                  return (
                    <motion.div
                      key={dish.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className={`bg-card rounded-xl border p-3 ${
                        isOff ? 'border-border/30 opacity-60' : 'border-border/50'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="relative size-16 rounded-lg overflow-hidden bg-muted shrink-0">
                          {displayImg ? (
                            <Image src={displayImg} alt={dish.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="size-6 text-muted-foreground/40" />
                            </div>
                          )}
                          <button
                            onClick={() => handlePickImage(dish.id)}
                            className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Camera className="size-4 text-white" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium truncate ${isOff ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {dish.name}
                              {!dish.status.onShelf && (
                                <span className="ml-1 text-[10px] text-muted-foreground">已下架</span>
                              )}
                              {dish.status.soldOut && (
                                <span className="ml-1 text-[10px] text-destructive">售罄</span>
                              )}
                            </p>
                            <button
                              onClick={() => {
                                toggleDishShelf(shopId, dish.id, !dish.status.onShelf)
                                toast.success(dish.status.onShelf ? '已下架' : '已上架')
                              }}
                              className="shrink-0"
                              aria-label={dish.status.onShelf ? '下架' : '上架'}
                            >
                              {dish.status.onShelf ? (
                                <Eye className="size-4 text-foreground/60" />
                              ) : (
                                <EyeOff className="size-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{dish.description}</p>

                          {isEditing ? (
                            <div className="mt-2 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-8">名称</span>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={e => setEditName(e.target.value)}
                                  className="flex-1 h-7 px-2 bg-muted rounded text-xs outline-none"
                                  placeholder="菜品名称"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-8">描述</span>
                                <input
                                  type="text"
                                  value={editDesc}
                                  onChange={e => setEditDesc(e.target.value)}
                                  className="flex-1 h-7 px-2 bg-muted rounded text-xs outline-none"
                                  placeholder="描述"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-8">价格</span>
                                <input
                                  type="number"
                                  value={editPrice}
                                  onChange={e => setEditPrice(e.target.value)}
                                  className="flex-1 h-7 px-2 bg-muted rounded text-xs outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-8">库存</span>
                                <input
                                  type="number"
                                  value={editStock}
                                  onChange={e => setEditStock(e.target.value)}
                                  placeholder="不限留空"
                                  className="flex-1 h-7 px-2 bg-muted rounded text-xs outline-none"
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingDish(null)}
                                  className="h-7 px-3 rounded-full border border-border text-xs text-muted-foreground"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(dish.id)}
                                  className="h-7 px-3 rounded-full bg-foreground text-background text-xs flex items-center gap-1"
                                >
                                  <Check className="size-3" />
                                  保存
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-base font-bold text-foreground tabular-nums">
                                ¥{displayPrice.toFixed(1)}
                              </span>
                               <div className="flex items-center gap-2">
                                 <button
                                   onClick={() => openSpecEditor(dish)}
                                   className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-0.5"
                                 >
                                   <Layers className="size-2.5" />
                                   规格
                                 </button>
                                 <button
                                  onClick={() => {
                                    toggleDishSoldOut(shopId, dish.id, !dish.status.soldOut)
                                    toast.success(dish.status.soldOut ? '已恢复供应' : '已设为售罄')
                                  }}
                                  className={`text-[10px] px-2 py-0.5 rounded ${
                                    dish.status.soldOut
                                      ? 'bg-destructive/10 text-destructive'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {dish.status.soldOut ? '已售罄' : '在售'}
                                </button>
                                <button
                                  onClick={() => handleStartEdit(dish)}
                                  aria-label="编辑"
                                >
                                  <Edit3 className="size-3.5 text-muted-foreground" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })
               )}
             </div>
        </div>
      </div>

      {/* 规格/加料编辑弹层 */}
      <AnimatePresence>
        {specDishId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
            onClick={() => setSpecDishId(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              {/* 头部 */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <span className="font-semibold text-sm text-foreground">规格与加料</span>
                <button
                  onClick={() => setSpecDishId(null)}
                  className="size-7 flex items-center justify-center rounded-full bg-muted/60 text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Tab 切换 */}
              <div className="flex border-b border-border/30">
                {[{ k: 'specs', l: '规格组（单选）' }, { k: 'extras', l: '加料（多选加价）' }].map(tab => (
                  <button
                    key={tab.k}
                    onClick={() => setSpecTab(tab.k as 'specs' | 'extras')}
                    className={`flex-1 py-2.5 text-xs relative transition-colors ${
                      specTab === tab.k ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {tab.l}
                    {specTab === tab.k && (
                      <motion.div layoutId="merchant-spec-tab" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-foreground rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* 内容区 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {specTab === 'specs' && (
                  <>
                    {/* 新增规格组 */}
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border/30">
                      <p className="text-xs font-medium text-foreground">新增规格组</p>
                      <input
                        type="text"
                        value={newSpecName}
                        onChange={e => setNewSpecName(e.target.value)}
                        placeholder="规格组名，如：辣度、份量"
                        className="w-full h-8 px-2.5 bg-card border border-border/50 rounded text-xs outline-none focus:border-foreground/30"
                      />
                      <input
                        type="text"
                        value={newSpecOptions}
                        onChange={e => setNewSpecOptions(e.target.value)}
                        placeholder="选项，用逗号分隔，如：微辣,中辣,特辣"
                        className="w-full h-8 px-2.5 bg-card border border-border/50 rounded text-xs outline-none focus:border-foreground/30"
                      />
                      <button
                        onClick={handleAddSpecGroup}
                        className="w-full h-8 rounded-full bg-foreground text-background text-xs font-medium"
                      >
                        添加规格组
                      </button>
                    </div>

                    {/* 已有规格组列表 */}
                    {specGroups.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">暂无规格组</p>
                    ) : (
                      specGroups.map(group => (
                        <div key={group.id} className="bg-card border border-border/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-foreground">{group.name}</span>
                            <button
                              onClick={() => handleDeleteSpecGroup(group.id)}
                              className="size-6 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {group.options.map(opt => (
                              <span
                                key={opt.id}
                                className="px-2 py-1 rounded-full bg-muted/60 text-[11px] text-foreground/80"
                              >
                                {opt.label}
                                {opt.priceDelta > 0 && <span className="ml-1 text-primary">+¥{opt.priceDelta}</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {specTab === 'extras' && (
                  <>
                    {/* 新增加料 */}
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border/30">
                      <p className="text-xs font-medium text-foreground">新增加料</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newExtraName}
                          onChange={e => setNewExtraName(e.target.value)}
                          placeholder="加料名，如：加蛋"
                          className="flex-1 h-8 px-2.5 bg-card border border-border/50 rounded text-xs outline-none focus:border-foreground/30"
                        />
                        <input
                          type="number"
                          value={newExtraPrice}
                          onChange={e => setNewExtraPrice(e.target.value)}
                          placeholder="加价"
                          className="w-20 h-8 px-2.5 bg-card border border-border/50 rounded text-xs outline-none focus:border-foreground/30"
                        />
                      </div>
                      <button
                        onClick={handleAddExtra}
                        className="w-full h-8 rounded-full bg-foreground text-background text-xs font-medium"
                      >
                        添加加料
                      </button>
                    </div>

                    {/* 已有加料列表 */}
                    {extras.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">暂无加料</p>
                    ) : (
                      <div className="space-y-2">
                        {extras.map(extra => (
                          <div key={extra.id} className="flex items-center justify-between p-2.5 bg-card border border-border/50 rounded-lg">
                            <div>
                              <span className="text-sm text-foreground">{extra.name}</span>
                              <span className="text-xs text-primary ml-2">+¥{extra.price.toFixed(1)}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteExtra(extra.id)}
                              className="size-6 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 底部保存 */}
              <div className="px-4 py-3 border-t border-border/30">
                <button
                  onClick={handleSaveSpecs}
                  className="w-full h-10 rounded-full bg-foreground text-background text-sm font-medium flex items-center justify-center gap-1"
                >
                  <Check className="size-4" />
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 隐藏的文件输入（编辑时用） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 新增菜品弹窗 */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:w-[90%] sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">新增菜品</h3>
                <button onClick={() => setShowAddModal(false)} className="size-7 rounded-full flex items-center justify-center hover:bg-muted">
                  <X className="size-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">菜品图片</label>
                  <div
                    onClick={() => addFileInputRef.current?.click()}
                    className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-foreground/40 transition-colors overflow-hidden relative"
                  >
                    {addImage ? (
                      <>
                        <Image src={addImage} alt="预览" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Camera className="size-5 text-white" />
                        </div>
                      </>
                    ) : (
                      <>
                        <Camera className="size-6 text-muted-foreground/50 mb-1" />
                        <span className="text-xs text-muted-foreground">点击上传图片</span>
                      </>
                    )}
                  </div>
                  <input
                    ref={addFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAddFileChange}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">菜品名称</label>
                  <input
                    type="text"
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    placeholder="如：宫保鸡丁"
                    className="w-full h-10 px-3 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">描述</label>
                  <input
                    type="text"
                    value={addDesc}
                    onChange={e => setAddDesc(e.target.value)}
                    placeholder="如：经典川菜，鸡肉鲜嫩"
                    className="w-full h-10 px-3 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">所属分类</label>
                  <div className="relative">
                    <select
                      value={addCategoryId || activeCategory}
                      onChange={e => setAddCategoryId(e.target.value)}
                      className="w-full h-10 px-3 pr-8 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/20 appearance-none cursor-pointer"
                    >
                      {getAllCategories(shopId).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}{cat.isCustom ? '（自定义）' : ''}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">价格（元）</label>
                  <input
                    type="number"
                    value={addPrice}
                    onChange={e => setAddPrice(e.target.value)}
                    placeholder="0.0"
                    className="w-full h-10 px-3 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleAddDish}
                    className="w-full h-10 rounded-full bg-foreground text-background text-sm font-medium"
                  >
                    确认添加
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 管理分类弹层 */}
      <AnimatePresence>
        {showCatManager && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
            onClick={() => { setShowCatManager(false); setEditingCatId(null); setEditingCatName(''); setNewCatName('') }}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:w-[90%] sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
                <h3 className="text-lg font-semibold">分类管理</h3>
                <button
                  onClick={() => { setShowCatManager(false); setEditingCatId(null); setEditingCatName(''); setNewCatName('') }}
                  className="size-7 rounded-full flex items-center justify-center hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* 新增分类 */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="输入新分类名称"
                    className="flex-1 h-10 px-3 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (newCatName.trim()) {
                          const id = addCategory(shopId, newCatName.trim())
                          setActiveCategory(id)
                          setNewCatName('')
                          toast.success('分类已添加')
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!newCatName.trim()) {
                        toast.info('请输入分类名称')
                        return
                      }
                      const id = addCategory(shopId, newCatName.trim())
                      setActiveCategory(id)
                      setNewCatName('')
                      toast.success('分类已添加')
                    }}
                    className="px-4 h-10 rounded-lg bg-foreground text-background text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="size-4" />
                    新增
                  </button>
                </div>

                {/* 分类列表 */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">共 {getAllCategories(shopId).length} 个分类</p>
                  {getAllCategories(shopId).map(cat => (
                    <motion.div
                      key={cat.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 h-12 px-3 bg-muted/50 rounded-lg"
                    >
                      {!cat.isCustom && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-foreground/10 text-foreground/70 rounded shrink-0">
                          系统
                        </span>
                      )}
                      {editingCatId === cat.id ? (
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={e => setEditingCatName(e.target.value)}
                          className="flex-1 h-8 px-2 bg-card rounded text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              renameCategory(shopId, cat.id, editingCatName)
                              setEditingCatId(null)
                              setEditingCatName('')
                              toast.success('已重命名')
                            }
                            if (e.key === 'Escape') {
                              setEditingCatId(null)
                              setEditingCatName('')
                            }
                          }}
                        />
                      ) : (
                        <span className="flex-1 text-sm text-foreground truncate">{cat.name}</span>
                      )}
                      {cat.isCustom && (
                        <>
                          {editingCatId === cat.id ? (
                            <button
                              onClick={() => {
                                renameCategory(shopId, cat.id, editingCatName)
                                setEditingCatId(null)
                                setEditingCatName('')
                                toast.success('已重命名')
                              }}
                              className="size-7 rounded-full flex items-center justify-center text-foreground hover:bg-foreground/10"
                            >
                              <Check className="size-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCatId(cat.id)
                                setEditingCatName(cat.name)
                              }}
                              className="size-7 rounded-full flex items-center justify-center text-foreground/60 hover:bg-foreground/10"
                            >
                              <Edit3 className="size-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`确定删除分类「${cat.name}」吗？该分类下的菜品也会被删除。`)) {
                                deleteCategory(shopId, cat.id)
                                if (activeCategory === cat.id) {
                                  const firstCat = getAllCategories(shopId).find(c => c.id !== cat.id)
                                  setActiveCategory(firstCat?.id || '')
                                }
                                toast.success('分类已删除')
                              }
                            }}
                            className="size-7 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}
                      {!cat.isCustom && (
                        <ChevronRight className="size-4 text-muted-foreground/40" />
                      )}
                    </motion.div>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  提示：系统分类由平台预置，不可删除或重命名；您可以新增自定义分类，菜品可归入任意分类。
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

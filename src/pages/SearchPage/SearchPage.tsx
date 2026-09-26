import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search as SearchIcon, X, Clock, Trash2, Flame } from 'lucide-react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import TopNavBar from '@/components/TopNavBar'
import ShopCard from '@/components/ShopCard'
import { getAllShops, type IShop } from '@/data/shops'
import { MOCK_CATEGORIES } from '@/data/search-page'

const HISTORY_KEY = 'food_delivery_search_history'
const HOT_WORDS = ['便当', '奶茶', '披萨', '寿司', '汉堡', '咖啡', '麻辣烫', '沙拉']

export default function SearchPage() {
  const [params] = useSearchParams()
  const [keyword, setKeyword] = useState(params.get('keyword') ?? '')
  const [activeCategory, setActiveCategory] = useState(params.get('category') ?? '1')
  const [history, setHistory] = useState<string[]>([])
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const stored = scopedStorage.getItem(HISTORY_KEY)
    if (stored) {
      try { setHistory(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [])

  const saveHistory = (word: string) => {
    const next = [word, ...history.filter(h => h !== word)].slice(0, 10)
    setHistory(next)
    scopedStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  }

  const clearHistory = () => {
    setHistory([])
    scopedStorage.removeItem(HISTORY_KEY)
  }

  const results = useMemo(() => {
    const catName = MOCK_CATEGORIES.find(c => c.id === activeCategory)?.name
    return getAllShops().filter(shop => {
      const matchCat = activeCategory === '1' || shop.category === catName
      const matchKw = !keyword ||
        shop.name.includes(keyword) ||
        shop.categories.some(cat => cat.dishes.some(d => d.name.includes(keyword)))
      return matchCat && matchKw
    })
  }, [keyword, activeCategory])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.trim()) {
      saveHistory(keyword.trim())
    }
    setFocused(false)
  }

  const handleHistoryClick = (word: string) => {
    setKeyword(word)
    saveHistory(word)
    setFocused(false)
  }

  const handleHotClick = (word: string) => {
    setKeyword(word)
    saveHistory(word)
    setFocused(false)
  }

  const showHistory = focused && !keyword && history.length > 0
  const showHot = !keyword && !focused

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopNavBar title="搜索" />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 搜索框 */}
        <div className="px-4 py-2 border-b border-border/30">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 200)}
                placeholder="搜索商家、菜品"
                autoFocus
                className="w-full h-9 pl-9 pr-8 bg-muted rounded-full text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-foreground/10"
              />
              {keyword && (
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  type="button"
                  onClick={() => setKeyword('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-muted-foreground/20 text-background"
                >
                  <X className="size-3" />
                </motion.button>
              )}
            </div>
          </form>
        </div>

        {/* 品类筛选 */}
        <div className="px-2 py-2 border-b border-border/30">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {MOCK_CATEGORIES.map(cat => (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {cat.icon} {cat.name}
              </motion.button>
            ))}
          </div>
        </div>

        {/* 搜索历史 / 结果 */}
        <div className="flex-1 overflow-y-auto">
            {showHistory ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">搜索历史</span>
                  <button
                    onClick={clearHistory}
                    className="p-1 text-muted-foreground"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map((word, i) => (
                    <motion.button
                      key={word}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleHistoryClick(word)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-muted rounded-full text-xs text-muted-foreground"
                    >
                      <Clock className="size-3" />
                      {word}
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : showHot ? (
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Flame className="size-4 text-foreground" />
                  <span className="text-sm font-medium text-foreground">热门搜索</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {HOT_WORDS.map((word, i) => (
                    <motion.button
                      key={word}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleHotClick(word)}
                      className="px-3 py-1.5 bg-muted rounded-full text-xs text-foreground/80"
                    >
                      {i < 3 && <span className="text-destructive mr-0.5">{i + 1}</span>}
                      {word}
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {results.length > 0 ? (
                  results.map((shop, i) => (
                    <ShopCard key={shop.id} shop={shop} index={i} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <SearchIcon className="size-12 mb-3 opacity-30" />
                    <p className="text-sm">暂无相关商家</p>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
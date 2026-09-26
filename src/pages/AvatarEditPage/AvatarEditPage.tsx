import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Camera, Check, X, Image as ImageIcon,
} from 'lucide-react'
import { avatarImages } from '@lark-apaas/client-toolkit-lite'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { usePageBack } from '@/hooks/useNavigationStack'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const PRESET_AVATARS = [
  avatarImages.avatarImg1,
  avatarImages.avatarImg2,
  avatarImages.avatarImg3,
  avatarImages.avatarImg4,
  avatarImages.avatarImg5,
  avatarImages.avatarImg6,
  avatarImages.avatarImg7,
  avatarImages.avatarImg8,
]

// 压缩图片到 200x200 以内，避免 localStorage 超限
function compressImage(file: File, maxSize = 200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('canvas 不可用'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        try {
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export default function AvatarEditPage() {
  const pageBack = usePageBack()
  const { user, updateProfile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nickname, setNickname] = useState(user.nickname)
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar)
  const [saving, setSaving] = useState(false)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.info('请选择图片文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.info('图片大小不能超过 5MB')
      return
    }
    try {
      const compressed = await compressImage(file)
      setSelectedAvatar(compressed)
      toast.success('头像已选择')
    } catch {
      toast.error('图片处理失败')
    }
    // 重置 input 允许重复选择同一文件
    e.target.value = ''
  }, [])

  const handleSave = async () => {
    if (!nickname.trim()) {
      toast.info('昵称不能为空')
      return
    }
    if (nickname.length > 20) {
      toast.info('昵称不能超过 20 个字符')
      return
    }
    setSaving(true)
    try {
      updateProfile({
        avatar: selectedAvatar,
        nickname: nickname.trim(),
      })
      toast.success('已保存')
      setTimeout(() => pageBack(), 400)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between h-12 px-3 border-b border-border/30 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => pageBack()}
          className="size-8 -ml-1 flex items-center justify-center"
        >
          <ChevronLeft className="size-5 text-foreground" />
        </motion.button>
        <h1 className="text-base font-semibold text-foreground">编辑资料</h1>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSave}
          disabled={saving}
          className="size-8 -mr-1 flex items-center justify-center text-foreground"
        >
          <Check className="size-5" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 昵称 */}
        <div className="px-4 py-3 border-b border-border/30">
          <label className="text-xs text-muted-foreground block mb-2">昵称</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value.slice(0, 20))}
            placeholder="请输入昵称"
            className="w-full h-10 px-3 bg-card border border-border/50 rounded-lg text-sm text-foreground outline-none focus:border-foreground transition-colors"
          />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">{nickname.length}/20</p>
        </div>

        {/* 头像预览 */}
        <div className="flex flex-col items-center py-8 border-b border-border/30">
          <div className="relative">
            <Avatar className="size-24 border-4 border-border/50">
              <AvatarImage src={selectedAvatar} alt={nickname} />
              <AvatarFallback className="bg-foreground/10">
                <ImageIcon className="size-10 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 size-8 rounded-full bg-foreground text-background flex items-center justify-center shadow-sm"
            >
              <Camera className="size-4" />
            </motion.button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">点击相机图标上传本地图片</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* 预设头像 */}
        <div className="px-4 py-4">
          <p className="text-xs text-muted-foreground mb-3">选择预设头像</p>
          <div className="grid grid-cols-4 gap-4">
            {PRESET_AVATARS.map((src, i) => {
              const isSelected = selectedAvatar === src
              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedAvatar(src)}
                  className="relative aspect-square rounded-full overflow-hidden"
                >
                  <Avatar className="w-full h-full">
                    <AvatarImage src={src} alt={`预设头像 ${i + 1}`} />
                    <AvatarFallback className="bg-muted">
                      <ImageIcon className="size-6 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="absolute inset-0 bg-foreground/60 flex items-center justify-center"
                      >
                        <Check className="size-6 text-background" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              )
            })}
          </div>
        </div>

        <div className="px-4 py-6">
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            头像和昵称在三端全局生效，刷新页面后保留。
            <br />
            本地上传的头像会被压缩到 200px 以内保存到本地存储。
          </p>
        </div>
      </div>

      {/* 底部保存按钮 */}
      <div className="px-4 py-3 border-t border-border/30 flex-shrink-0 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存修改'}
        </motion.button>
      </div>
    </div>
  )
}

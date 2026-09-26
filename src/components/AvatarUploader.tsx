import { useRef } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { compressImage } from '@/lib/image'

interface AvatarUploaderProps {
  src: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg'
  onUpload: (base64: string) => void
}

export default function AvatarUploader({ src, alt = '头像', fallback = '用', size = 'md', onUpload }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const sizeClass = size === 'lg' ? 'size-20' : size === 'sm' ? 'size-10' : 'size-14'

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.info('请选择图片文件')
      return
    }
    try {
      const compressed = await compressImage(file, 400, 0.8)
      onUpload(compressed)
      toast.success('头像已更新')
    } catch {
      toast.error('头像处理失败')
    }
    // 允许重复选同一文件
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="relative group"
      aria-label="更换头像"
    >
      <Avatar className={sizeClass}>
        <AvatarImage src={src} alt={alt} className="object-cover" />
        <AvatarFallback className="bg-muted text-muted-foreground">{fallback}</AvatarFallback>
      </Avatar>
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <Camera className="size-5" />
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />
    </button>
  )
}

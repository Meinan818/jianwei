import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 相对时间格式化（消息列表用）
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 0) return '刚刚'

  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`

  // 超过 7 天显示具体日期
  const d = new Date(timestamp)
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}/${day}`
}

// 订单时间格式化：今天显示 HH:mm，今年内显示 MM-DD HH:mm，跨年显示 YYYY-MM-DD HH:mm
export function formatOrderTime(timestamp: number): string {
  const now = new Date()
  const d = new Date(timestamp)
  const isSameDay = d.toDateString() === now.toDateString()
  const isSameYear = d.getFullYear() === now.getFullYear()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (isSameDay) return timeStr
  if (isSameYear) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${timeStr}`
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${timeStr}`
}

// 倒计时格式化：将毫秒差转成 MM:SS 或 HH:MM:SS
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

// 聊天页时间分组格式化
export function formatChatTime(timestamp: number): string {
  const now = new Date()
  const d = new Date(timestamp)
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')

  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return `${hours}:${minutes}`

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hours}:${minutes}`

  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}/${day} ${hours}:${minutes}`
}

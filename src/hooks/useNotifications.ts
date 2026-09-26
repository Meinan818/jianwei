import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import React from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'
import { NOTIFICATION_STORAGE_KEY, getMockNotificationsByRole } from '@/data/messages'
import type { INotificationMessage, NotificationCategory } from '@/data/messages'
import { useAuth } from '@/hooks/useAuth'

function getStorageKey(role: string): string {
  return `${NOTIFICATION_STORAGE_KEY}_${role}`
}

interface NotificationContextValue {
  notifications: INotificationMessage[]
  unreadCount: number
  unreadByCategory: Record<NotificationCategory, number>
  markAsRead: (id: string) => void
  markAllAsRead: (category?: NotificationCategory) => void
  pushNotification: (msg: Omit<INotificationMessage, 'id' | 'read' | 'createdAt'> & { id?: string }) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const role = user.role || 'customer'
  const [notifications, setNotifications] = useState<INotificationMessage[]>([])

  // 角色切换时重新加载对应角色的通知
  useEffect(() => {
    try {
      const key = getStorageKey(role)
      const raw = scopedStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as INotificationMessage[]
        // ✅ 一次性迁移：检测到旧版顾客口吻跨端通知（含 MOCK_NOTIFICATIONS 的 id 前缀 n1/n2/n6 等）
        // 时，替换为当前角色正确视角的通知（幂等）
        const hasLegacyCustomerNotifications = parsed.some(n =>
          /^n[0-9]+$/.test(n.id) ||
          n.content.includes('正在为您备餐') ||
          n.content.includes('感谢您的支持，期待您的评价')
        )
        if (hasLegacyCustomerNotifications) {
          const fresh = getMockNotificationsByRole(role as 'customer' | 'merchant' | 'rider')
          setNotifications(fresh)
          scopedStorage.setItem(key, JSON.stringify(fresh))
        } else {
          setNotifications(parsed)
        }
      } else {
        const fresh = getMockNotificationsByRole(role as 'customer' | 'merchant' | 'rider')
        setNotifications(fresh)
        scopedStorage.setItem(key, JSON.stringify(fresh))
      }
    } catch {
      setNotifications([])
    }
  }, [role])

  const save = useCallback((list: INotificationMessage[], currentRole: string) => {
    setNotifications(list)
    scopedStorage.setItem(getStorageKey(currentRole), JSON.stringify(list))
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n)
      scopedStorage.setItem(getStorageKey(role), JSON.stringify(updated))
      return updated
    })
  }, [role])

  const markAllAsRead = useCallback((category?: NotificationCategory) => {
    setNotifications(prev => {
      const updated = prev.map(n => {
        if (category && n.category !== category) return n
        return { ...n, read: true }
      })
      scopedStorage.setItem(getStorageKey(role), JSON.stringify(updated))
      return updated
    })
  }, [role])

  const pushNotification = useCallback((msg: Omit<INotificationMessage, 'id' | 'read' | 'createdAt'> & { id?: string }) => {
    const newMsg: INotificationMessage = {
      id: msg.id || `n_${Date.now()}`,
      title: msg.title,
      content: msg.content,
      category: msg.category,
      read: false,
      createdAt: Date.now(),
      orderId: msg.orderId,
      actionUrl: msg.actionUrl,
      icon: msg.icon,
    }
    setNotifications(prev => {
      const updated = [newMsg, ...prev]
      scopedStorage.setItem(getStorageKey(role), JSON.stringify(updated))
      return updated
    })
  }, [role])

  const clearAll = useCallback(() => {
    save([], role)
  }, [save, role])

  const unreadCount = notifications.filter(n => !n.read).length
  const unreadByCategory = {
    system: notifications.filter(n => !n.read && n.category === 'system').length,
    order: notifications.filter(n => !n.read && n.category === 'order').length,
    activity: notifications.filter(n => !n.read && n.category === 'activity').length,
  }

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    unreadByCategory,
    markAsRead,
    markAllAsRead,
    pushNotification,
    clearAll,
  }

  return React.createElement(NotificationContext.Provider, { value }, children)
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return ctx
}

/**
 * 非组件内使用的工具函数：按角色获取未读数（用于 TabBar 等 Context 外部场景）
 */
export function getNotificationUnreadCount(role: string): number {
  try {
    const raw = scopedStorage.getItem(getStorageKey(role))
    if (!raw) {
      const mock = getMockNotificationsByRole((role as 'customer' | 'merchant' | 'rider'))
      return mock.filter(n => !n.read).length
    }
    const list = JSON.parse(raw) as INotificationMessage[]
    return list.filter(n => !n.read).length
  } catch {
    return 0
  }
}

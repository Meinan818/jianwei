// EXPORTS: useRiderStatus, UseRiderStatusReturn, RIDER_STATUS_KEY
import { useState, useEffect, useCallback } from 'react'
import { scopedStorage } from '@lark-apaas/client-toolkit-lite'

const RIDER_STATUS_KEY = 'food_delivery_rider_status'

export interface IRiderStatus {
  [riderId: string]: {
    isOnline: boolean        // 是否上线接单
    totalDelivered: number   // 累计完成单量
    totalEarnings: number    // 累计收入
    level: number            // 骑手等级
  }
}

function getInitialStatus(): IRiderStatus {
  // 内置几个演示骑手的初始状态
  return {
    r1: { isOnline: true, totalDelivered: 1286, totalEarnings: 4501, level: 3 },
    r2: { isOnline: true, totalDelivered: 892, totalEarnings: 3122, level: 2 },
    r3: { isOnline: false, totalDelivered: 545, totalEarnings: 1907, level: 1 },
  }
}

export function useRiderStatus() {
  const [riderStatus, setRiderStatus] = useState<IRiderStatus>({})

  useEffect(() => {
    const stored = scopedStorage.getItem(RIDER_STATUS_KEY)
    if (stored) {
      try {
        setRiderStatus(JSON.parse(stored))
      } catch {
        const init = getInitialStatus()
        setRiderStatus(init)
        scopedStorage.setItem(RIDER_STATUS_KEY, JSON.stringify(init))
      }
    } else {
      const init = getInitialStatus()
      setRiderStatus(init)
      scopedStorage.setItem(RIDER_STATUS_KEY, JSON.stringify(init))
    }
  }, [])

  const save = useCallback((status: IRiderStatus) => {
    setRiderStatus(status)
    scopedStorage.setItem(RIDER_STATUS_KEY, JSON.stringify(status))
  }, [])

  const toggleRiderOnline = useCallback((riderId: string, isOnline: boolean) => {
    setRiderStatus(prev => {
      const updated = { ...prev }
      if (!updated[riderId]) {
        updated[riderId] = { isOnline, totalDelivered: 0, totalEarnings: 0, level: 1 }
      } else {
        updated[riderId] = { ...updated[riderId], isOnline }
      }
      scopedStorage.setItem(RIDER_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const addDeliveryEarning = useCallback((riderId: string, amount: number) => {
    setRiderStatus(prev => {
      const updated = { ...prev }
      if (!updated[riderId]) {
        updated[riderId] = { isOnline: true, totalDelivered: 1, totalEarnings: amount, level: 1 }
      } else {
        updated[riderId] = {
          ...updated[riderId],
          totalDelivered: updated[riderId].totalDelivered + 1,
          totalEarnings: updated[riderId].totalEarnings + amount,
        }
      }
      scopedStorage.setItem(RIDER_STATUS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  return {
    riderStatus,
    toggleRiderOnline,
    addDeliveryEarning,
    save,
  }
}

export type UseRiderStatusReturn = ReturnType<typeof useRiderStatus>

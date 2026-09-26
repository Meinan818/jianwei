// EXPORTS: PageLevel, PAGE_PARENT, PAGE_TAB_ROOT, isTabRoot
// 页面层级定义：决定了"按返回键应该回到哪里"，以及 Tab 切换时是否入栈。
// Tab 根页（一级）之间切换用 replace，不入历史栈；二级页 push 进栈，返回回到父级。

import type { UserRole } from '@/data/auth'

export type PageLevel = 'tab' | 'detail'

// 每端的 Tab 根页（一级）
export const TAB_ROOTS: Record<UserRole, string[]> = {
  customer: ['/customer', '/customer/orders', '/customer/profile', '/customer/messages'],
  merchant: ['/merchant', '/merchant/orders', '/merchant/reviews', '/merchant/messages'],
  rider: ['/rider', '/rider/hall', '/rider/tasks', '/rider/messages'],
}

/**
 * 父级映射表：二级页 → 父级路径（返回时的目标）
 * 规则：
 * - 订单跟踪页：从订单列表来则回订单列表，从结算来则回首页（统一回订单列表更合理）
 * - 结算页：返回商家详情（但结算属于流程内，按层级回商家详情可能导致"返回又加购"，主流 App 回上一个 push 页）
 *   我们用栈式 + 层级混合：栈是实际的 push 记录，父级映射用于兜底和首次进入时校验
 * - 商家详情 → 首页
 * - 搜索 → 首页
 * - 商品编辑 → 商家端 dishes（但 dishes 不是 tab 根，是从店铺管理进去的二级）
 *   实际上商家端 dishes 是 /merchant/dishes，通过首页快捷入口进去，属于二级
 */
export const PAGE_PARENT: Record<string, string> = {
  // 顾客端
  '/customer/search': '/customer',
  '/customer/shop': '/customer',          // /shop/:id → 首页（按 tab 根）
  '/customer/checkout': '/customer',      // 结算 → 首页（结算属于流程页，返回不回到商家详情避免回退加购）
  '/customer/order': '/customer/orders',  // /order/:id/track → 订单列表
  '/customer/coupons': '/customer/profile',
  '/customer/review': '/customer/orders',
  '/customer/avatar-edit': '/customer/profile',
  // 商家端
  '/merchant/dishes': '/merchant',
  '/merchant/shop': '/merchant',
  // 骑手端
  '/rider/record': '/rider',
}

/**
 * 判断某路径是否是当前端的 Tab 根页（一级）
 */
export function isTabRoot(pathname: string, role: UserRole): boolean {
  const roots = TAB_ROOTS[role]
  return roots.some(root => {
    if (root === '/') return pathname === '/'
    return pathname === root || pathname === root + '/'
  })
}

/**
 * 根据当前路径判断属于哪一端
 */
export function getPathRole(pathname: string): UserRole {
  if (pathname.startsWith('/merchant')) return 'merchant'
  if (pathname.startsWith('/rider')) return 'rider'
  return 'customer'
}

/**
 * 获取路径的"父级"兜底路径（用于栈被意外破坏时的层级回退）
 */
export function getParentPath(pathname: string): string | null {
  // 精确匹配
  if (PAGE_PARENT[pathname]) return PAGE_PARENT[pathname]
  // 动态路由匹配：去掉最后一段
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length <= 1) return null
  // 匹配前缀（如 /shop/1 → /shop → /）
  const prefix = '/' + parts.slice(0, parts.length - 1).join('/')
  if (PAGE_PARENT[prefix]) return PAGE_PARENT[prefix]
  return null
}

/**
 * Supabase 客户端（第 1 期：真实登录）
 *
 * 环境变量：VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *   - 本地开发放 `.env.local`（已在 .gitignore 里排除）
 *   - 线上在 Cloudflare Pages 的 Environment variables 里配置
 *   - anon / publishable key 设计上就是公开的（会打进前端包），安全完全靠数据库 RLS
 *   - **service_role / secret key 绝不能出现在前端**
 *
 * 设计取舍：两个变量缺失时 `supabase` 为 null，useAuth 会退回原来的本地模拟登录，
 * 应用照常可用。这样在还没配好线上环境变量之前，已部署的站点不会白屏。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

/** 是否已配置 Supabase（未配置时走本地模拟登录） */
export const supabaseEnabled = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // 不使用邮件魔法链接/确认邮件，无需从 URL 解析会话
        detectSessionInUrl: false,
        storageKey: 'food_delivery_supabase_auth',
      },
    })
  : null

if (!supabaseEnabled) {
  console.warn(
    '[supabase] 未检测到 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，' +
      '当前使用本地模拟登录。配置环境变量后即自动切换到真实认证。',
  )
}

/**
 * 手机号 → 合成邮箱（方案 A：登录页仍收手机号，内部映射成邮箱调 Supabase Auth）。
 *
 * ⚠️ 前缀 `phone` 不能省：Supabase 会拒绝「本地部分纯数字」的邮箱
 * （实测 `13900000099@jianwei.app` 返回 email_address_invalid，登录甚至报 500）。
 * 演示账号邮箱也按同一规则生成：phone13800000001@jianwei.app
 */
export function phoneToAuthEmail(phone: string): string {
  return `phone${phone.replace(/\D/g, '')}@jianwei.app`
}

/** 合成邮箱 → 手机号（登录后回填展示用） */
export function authEmailToPhone(email: string | undefined | null): string {
  const m = /^phone(\d{11})@/.exec(email ?? '')
  return m ? m[1] : ''
}

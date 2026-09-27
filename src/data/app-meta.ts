/**
 * 应用元信息：品牌名、版次、版权年份集中在这里，避免散落在各页面。
 *
 * ⚠️ 约定（见 AGENTS.md §8.1）：**每完成一次「迭代」后把 APP_EDITION 加 1**。
 * 判定口径（2026-09-27 用户明确）：一个完整的功能 / 界面改动算一次迭代；
 * 纯文档整理、中间步骤、规则修正**不递增**，避免版本号被小操作顶上去。
 * 它同时驱动三端设置页显示的版本号与启动页底部的彩蛋文案。
 */

/** 对用户展示的品牌名（项目/仓库代号仍是「简味点单 / jianwei」） */
export const APP_BRAND = '饭否外卖'

/** 原型迭代版次：每完成一次迭代 +1（当前对应「第 2 期剩余数据上云：评价/优惠券/钱包」） */
export const APP_EDITION = 10

/** 三端设置页展示的版本号 */
export const APP_VERSION = `v${APP_EDITION}.0.0`

/** 版权年份：取运行时年份，避免每年都要改一次 */
export const APP_YEAR = new Date().getFullYear()

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * 把 1~99 的版次转成中文数字，用于启动页彩蛋「大野鸡第 N 版」。
 * 超出范围时退回阿拉伯数字，不抛错。
 */
export function editionLabel(edition: number = APP_EDITION): string {
  if (!Number.isInteger(edition) || edition < 1 || edition > 99) return `第${edition}版`
  if (edition < 10) return `第${CN_DIGITS[edition]}版`
  const tens = Math.floor(edition / 10)
  const ones = edition % 10
  const tensPart = tens === 1 ? '十' : `${CN_DIGITS[tens]}十`
  return `第${tensPart}${ones ? CN_DIGITS[ones] : ''}版`
}

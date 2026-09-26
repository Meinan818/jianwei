// EXPORTS: ICategory, MOCK_CATEGORIES
export interface ICategory {
  id: string
  name: string
  icon: string // emoji / 图标标识
}

export const MOCK_CATEGORIES: ICategory[] = [
  { id: '1', name: '全部', icon: '🍽️' },
  { id: '2', name: '快餐便当', icon: '🍱' },
  { id: '3', name: '中式炒菜', icon: '🥘' },
  { id: '4', name: '汉堡披萨', icon: '🍔' },
  { id: '5', name: '奶茶饮品', icon: '🧋' },
  { id: '6', name: '咖啡甜品', icon: '☕' },
  { id: '7', name: '烧烤炸串', icon: '🍢' },
  { id: '8', name: '日韩料理', icon: '🍣' },
  { id: '9', name: '轻食沙拉', icon: '🥗' },
  { id: '10', name: '粥粉面点', icon: '🥟' },
  { id: '11', name: '火锅冒菜', icon: '🍲' },
  { id: '12', name: '夜宵小吃', icon: '🍿' },
]
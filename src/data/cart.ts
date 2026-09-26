// EXPORTS: ICartItem, ICart, ICartItemSpec, ICartItemExtra

export interface ICartItemSpec {
  specId: string       // 规格组ID
  specName: string     // 规格组名，如「辣度」
  optionId: string     // 选中的规格选项ID
  optionLabel: string  // 选中的规格选项名称
  priceDelta: number   // 该规格加价（可为 0）
}

export interface ICartItemExtra {
  extraId: string
  name: string
  price: number
}

export interface ICartItem {
  dishId: string
  dishName: string
  basePrice: number    // 基础价（不含规格加价和加料）
  finalPrice: number   // 最终单价（基础价 + 规格加价 + 加料加价）
  quantity: number
  image: string
  specs: ICartItemSpec[]   // 已选规格（单选组的选择结果）
  extras: ICartItemExtra[] // 已选加料（多选）
  skuKey: string           // 规格唯一标识，用于区分同一菜品的不同规格
}

export interface ICart {
  shopId: string
  shopName: string
  items: ICartItem[]
}

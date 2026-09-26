// EXPORTS: ICheckoutPage, MOCK_CHECKOUT_PAGE
export interface ICheckoutPage {
  id: string
  deliveryType: 'delivery' | 'pickup' // 配送方式
  remark: string // 订单备注
  utensils: number // 餐具份数
  paymentMethod: 'wechat' | 'alipay' // 支付方式
  feeDetail: {
    goodsAmount: number // 商品金额
    deliveryFee: number // 配送费
    discount: number // 优惠金额
    finalAmount: number // 合计金额
  }
}

export const MOCK_CHECKOUT_PAGE: ICheckoutPage = {
  id: '1',
  deliveryType: 'delivery',
  remark: '',
  utensils: 1,
  paymentMethod: 'wechat',
  feeDetail: {
    goodsAmount: 68,
    deliveryFee: 5,
    discount: 10,
    finalAmount: 63,
  },
}
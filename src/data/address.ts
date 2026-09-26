// EXPORTS: IAddress, MOCK_ADDRESSES

export type AddressTag = 'home' | 'company' | 'school' | 'none'

export interface IAddress {
  id: string
  name: string
  phone: string
  address: string
  detail: string
  isDefault: boolean
  tag?: AddressTag
}

export const MOCK_ADDRESSES: IAddress[] = [
  { id: 'a1', name: '张三', phone: '138****1234', address: '朝阳区望京SOHO T1', detail: 'A座 1206室', isDefault: true, tag: 'company' },
  { id: 'a2', name: '张三', phone: '138****1234', address: '朝阳区青年路29号院', detail: '5号楼 1802室', isDefault: false, tag: 'home' },
  { id: 'a3', name: '李四', phone: '139****5678', address: '海淀区中关村大街', detail: '科贸大厦 3号楼 502', isDefault: false, tag: 'company' },
]
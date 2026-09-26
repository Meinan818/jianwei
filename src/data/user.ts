// EXPORTS: IUser, MOCK_USER
import { avatarImages } from '@lark-apaas/client-toolkit-lite'

export interface IUser {
  avatar: string
  nickname: string
  phone: string
}

export const MOCK_USER: IUser = {
  avatar: avatarImages.avatarImg1,
  nickname: '美食探索者',
  phone: '138****8888',
}
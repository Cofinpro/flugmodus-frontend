import type { Account } from './Account'

export interface Token {
  walletId: Account['walletId']
  signature: string
  spent: boolean
}

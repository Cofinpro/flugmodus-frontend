import type { Account } from './Account'
import type { Pair } from './Pair'

export interface Rfp {
  amount: number
  pairReq: Pair[]
  walletIdPaid: Account['walletId']
}

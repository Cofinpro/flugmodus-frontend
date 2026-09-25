import type { Token } from '../models/Token'
import type { Rfp } from '../models/Rfp'
import type { Pair } from '../models/Pair'

export function pay(token: Token, rfp: Rfp): Pair {
  return {
    tokenSignature: token.signature,
    pairResp: `${token.signature}:${rfp.walletIdPaid}`,
  }
}

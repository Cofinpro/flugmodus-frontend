import type { Account } from '../models/Account'
import type { Token } from '../models/Token'

function randomHex(byteLength: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(byteLength)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function createAccount(): { account: Account; token: Token } {
  const walletId = randomHex(8)
  const account: Account = { walletId, u: randomHex(4) }
  const token: Token = { walletId, signature: randomHex(32), spent: false }
  return { account, token }
}

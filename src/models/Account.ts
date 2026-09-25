export interface Account {
  accountId: string
  username: string
  u: string
  walletId: string
  balance: number
  createdAt: string
  bankPublicKey: string
  bankExponent: number
  photo?: string // Selfie mit Katzenohren (data-URL), bleibt auf dem Handy
}

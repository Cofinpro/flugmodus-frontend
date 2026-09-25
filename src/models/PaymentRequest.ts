export interface PaymentRequest {
  walletIdPaid: string
  nonce: string
  amount: number
  merchantName?: string // nur zur Anzeige beim Zahler
}

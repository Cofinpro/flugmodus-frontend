import { computed, ref } from 'vue'

export interface Coin {
  value: number
  coinIdBytes: Uint8Array
  signature: bigint
  masks: Uint8Array[]
  leftSalts: Uint8Array[]
  rightSalts: Uint8Array[]
}

export interface PendingTransaction {
  walletIdPaid: string
  nonce: string
  amount: number
  receivedAt: string
}

// Online-Guthaben kommt vom Konto (Bank, Server-Wahrheit).
// Offline-Guthaben ergibt sich aus den tatsächlich gehaltenen Münzen.
// Pending sind beim Verkaufen angenommene Zahlungen, die erst beim Sync ins Online-Guthaben übergehen.
export const coins = ref<Coin[]>([])
export const offlineBalance = computed(() => coins.value.reduce((sum, coin) => sum + coin.value, 0))

export const pendingTransactions = ref<PendingTransaction[]>([])
export const pendingBalance = computed(() =>
  pendingTransactions.value.reduce((sum, tx) => sum + tx.amount, 0),
)

export function resetWallet() {
  coins.value = []
  pendingTransactions.value = []
}

export function addCoin(coin: Coin) {
  coins.value.push(coin)
}

export function selectCoins(amount: number): Coin[] | null {
  const usable = coins.value.filter((coin) => coin.value <= amount)
  usable.sort((a, b) => b.value - a.value)

  const selected: Coin[] = []
  let remaining = amount
  for (const coin of usable) {
    if (coin.value <= remaining) {
      selected.push(coin)
      remaining -= coin.value
    }
    if (remaining === 0) break
  }

  return remaining === 0 ? selected : null
}

export function removeCoins(spent: Coin[]) {
  coins.value = coins.value.filter((coin) => !spent.includes(coin))
}

export function recordPendingReceive(walletIdPaid: string, nonce: string, amount: number) {
  pendingTransactions.value.push({ walletIdPaid, nonce, amount, receivedAt: new Date().toISOString() })
}

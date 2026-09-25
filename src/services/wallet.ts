import { computed, ref } from 'vue'

export interface Coin {
  value: number
  coinIdBytes: Uint8Array
  signature: bigint
  masks: Uint8Array[]
  leftSalts: Uint8Array[]
  rightSalts: Uint8Array[]
}

// Beim Verkaufen erhaltene Münze, so wie sie beim Sync der Bank vorgelegt wird.
export interface ReceivedCoin {
  coinId: string // hex, SHA-256 über die Paar-Hashes
  value: number
  signature: string // hex
}

export interface PendingTransaction {
  walletIdPaid: string
  nonce: string
  amount: number
  coins: ReceivedCoin[]
  receivedAt: string
}

// Online-Guthaben kommt vom Konto (Bank, Server-Wahrheit).
// Offline-Guthaben ergibt sich aus den tatsächlich gehaltenen Münzen.
// Pending sind beim Verkaufen angenommene Zahlungen, die erst beim Sync ins Online-Guthaben übergehen.
export const coins = ref<Coin[]>([])
export const offlineBalance = computed(() => coins.value.reduce((sum, coin) => sum + coin.value, 0))

// Archiv bereits ausgegebener Münzen – nur für die Fraud-Demo (echtes Doppelausgeben).
export const spentCoins = ref<Coin[]>([])

export const pendingTransactions = ref<PendingTransaction[]>([])
export const pendingBalance = computed(() =>
  pendingTransactions.value.reduce((sum, tx) => sum + tx.amount, 0),
)

export function resetWallet() {
  coins.value = []
  spentCoins.value = []
  pendingTransactions.value = []
}

export function addCoin(coin: Coin) {
  coins.value.push(coin)
}

export function selectCoins(amount: number, pool: Coin[] = coins.value): Coin[] | null {
  const usable = pool.filter((coin) => coin.value <= amount)
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
  spentCoins.value.push(...spent)
}

// Alle hier schon angenommenen Münzen – der Empfänger lehnt dieselbe coin_id ein zweites Mal ab
export function seenCoinIds(): Set<string> {
  return new Set(pendingTransactions.value.flatMap((tx) => tx.coins.map((coin) => coin.coinId)))
}

export function recordPendingReceive(walletIdPaid: string, nonce: string, amount: number, received: ReceivedCoin[]) {
  pendingTransactions.value.push({ walletIdPaid, nonce, amount, coins: received, receivedAt: new Date().toISOString() })
}

export function clearPendingTransactions() {
  pendingTransactions.value = []
}

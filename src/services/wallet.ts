import { ref } from 'vue'

// Online-Guthaben kommt vom Konto (Bank, Server-Wahrheit).
// Offline-Guthaben sind bereits abgehobene, aber noch nicht synchronisierte Münzen.
// Pending sind empfangene Münzen, die erst beim Sync ins Online-Guthaben übergehen.
export const offlineBalance = ref(0)
export const pendingBalance = ref(0)

export function resetWallet() {
  offlineBalance.value = 0
  pendingBalance.value = 0
}

export function applyTopUp(coinValue: number) {
  offlineBalance.value += coinValue
}

export function applyPayment(amount: number) {
  offlineBalance.value -= amount
}

export function applyPendingReceive(amount: number) {
  pendingBalance.value += amount
}

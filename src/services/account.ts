import type { Account } from '../models/Account'
import { API_HEADERS, backendUrl } from './backend'
import type { ReceivedCoin } from './wallet'

interface AccountApiResponse {
  account_id: string
  username: string
  u: string
  wallet_id: string
  balance: number
  created_at: string
  bank_public_key: string
  bank_exponent: number
}

function mapAccount(data: AccountApiResponse): Account {
  return {
    accountId: data.account_id,
    username: data.username,
    u: data.u,
    walletId: data.wallet_id,
    balance: data.balance,
    createdAt: data.created_at,
    bankPublicKey: data.bank_public_key,
    bankExponent: data.bank_exponent,
  }
}

export async function createAccount(username: string): Promise<Account> {
  if (!backendUrl.value) {
    throw new Error('Backend-URL ist nicht konfiguriert. Bitte zuerst den QR-Code der Backend-URL scannen.')
  }

  const response = await fetch(`${backendUrl.value}/accounts`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({ username }),
  })

  if (!response.ok) {
    throw new Error(`Konto konnte nicht erstellt werden (HTTP ${response.status})`)
  }

  const data: AccountApiResponse = await response.json()
  return mapAccount(data)
}

interface SyncApiResponse {
  account_id: string
  credited: number
  balance: number
}

export interface SyncResult {
  credited: number
  balance: number
}

const SYNC_ERRORS: Record<string, string> = {
  unknown_wallet_id: 'Die Wallet ist der Bank nicht bekannt.',
  no_coins: 'Keine Münzen zum Synchronisieren vorhanden.',
  duplicate_coin_in_request: 'Eine Münze wurde mehrfach eingereicht.',
  unknown_coin_value: 'Eine Münze hat einen unbekannten Wert.',
  invalid_coin: 'Eine Münze hat eine ungültige Signatur.',
  coin_already_redeemed: 'Eine Münze wurde bereits eingelöst – möglicher Double-Spend.',
}

export async function syncAccount(walletId: string, coins: ReceivedCoin[]): Promise<SyncResult> {
  const response = await fetch(`${backendUrl.value}/api/account/sync`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify({
      wallet_id: walletId,
      coins: coins.map((coin) => ({
        coin_id: coin.coinId,
        coin_value: coin.value,
        signature: coin.signature,
      })),
    }),
  })

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body) => body?.detail)
      .catch(() => undefined)
    const message = typeof detail === 'string' ? SYNC_ERRORS[detail] : undefined
    throw new Error(message ?? `Sync fehlgeschlagen (HTTP ${response.status})`)
  }

  const data: SyncApiResponse = await response.json()
  return { credited: data.credited, balance: data.balance }
}

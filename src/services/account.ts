import type { Account } from '../models/Account'
import { backendUrl } from './backend'

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })

  if (!response.ok) {
    throw new Error(`Konto konnte nicht erstellt werden (HTTP ${response.status})`)
  }

  const data: AccountApiResponse = await response.json()
  return mapAccount(data)
}
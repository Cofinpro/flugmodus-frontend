import {
  bytesToBigInt,
  bytesToHex,
  concatBytes,
  hexToBytes,
  modPow,
  sha256,
  shortHash,
  xorBytes,
} from './crypto'
import type { Coin } from './wallet'
import type { PaymentRequest } from '../models/PaymentRequest'

const NUM_PAIRS = 12

async function challengeBits(coinIdBytes: Uint8Array, walletIdPaid: string, nonceHex: string): Promise<number[]> {
  const input = concatBytes([coinIdBytes, new TextEncoder().encode(walletIdPaid), hexToBytes(nonceHex)])
  const digest = await sha256(input)
  const bits: number[] = []
  for (let i = 0; i < NUM_PAIRS; i++) {
    const byteIndex = i >> 3
    const bitOffset = 7 - (i % 8)
    bits.push((digest[byteIndex] >> bitOffset) & 1)
  }
  return bits
}

export interface PairReveal {
  bit: 0 | 1
  revealed: string // hex, 12 Byte: aⱼ (bit 0) oder aⱼ⊕u (bit 1)
  salt: string // hex, 12 Byte: passendes Salz zur offengelegten Seite
  otherHash: string // hex, 12 Byte: Hash der jeweils NICHT geöffneten Seite
}

export interface CoinReveal {
  value: number
  signature: string
  pairs: PairReveal[]
}

export interface PaymentProof {
  walletIdPaid: string
  nonce: string
  coins: CoinReveal[]
}

async function revealCoin(coin: Coin, identity: Uint8Array, request: PaymentRequest): Promise<CoinReveal> {
  const bits = await challengeBits(coin.coinIdBytes, request.walletIdPaid, request.nonce)

  const pairs: PairReveal[] = []
  for (let j = 0; j < NUM_PAIRS; j++) {
    if (bits[j] === 0) {
      const otherHash = await shortHash(concatBytes([xorBytes(coin.masks[j], identity), coin.rightSalts[j]]))
      pairs.push({
        bit: 0,
        revealed: bytesToHex(coin.masks[j]),
        salt: bytesToHex(coin.leftSalts[j]),
        otherHash: bytesToHex(otherHash),
      })
    } else {
      const otherHash = await shortHash(concatBytes([coin.masks[j], coin.leftSalts[j]]))
      pairs.push({
        bit: 1,
        revealed: bytesToHex(xorBytes(coin.masks[j], identity)),
        salt: bytesToHex(coin.rightSalts[j]),
        otherHash: bytesToHex(otherHash),
      })
    }
  }

  return { value: coin.value, signature: coin.signature.toString(16), pairs }
}

export async function buildPaymentProof(
  coinsToSpend: Coin[],
  accountUHex: string,
  request: PaymentRequest,
): Promise<PaymentProof> {
  const identity = hexToBytes(accountUHex)
  const coins = await Promise.all(coinsToSpend.map((coin) => revealCoin(coin, identity, request)))
  return { walletIdPaid: request.walletIdPaid, nonce: request.nonce, coins }
}

export interface VerifyResult {
  valid: boolean
  amount: number
  reason?: string
}

export async function verifyPaymentProof(
  proof: PaymentProof,
  request: PaymentRequest,
  bankPublicKeyHex: string,
  bankExponent: number,
): Promise<VerifyResult> {
  if (proof.walletIdPaid !== request.walletIdPaid || proof.nonce !== request.nonce) {
    return { valid: false, amount: 0, reason: 'Wallet-ID/Nonce stimmen nicht mit der Anfrage überein.' }
  }

  const modulus = BigInt(`0x${bankPublicKeyHex}`)
  const exponent = BigInt(bankExponent)

  let total = 0
  for (const coinReveal of proof.coins) {
    if (coinReveal.pairs.length !== NUM_PAIRS) {
      return { valid: false, amount: 0, reason: 'Ungültige Anzahl offengelegter Paare.' }
    }

    const hashes: Uint8Array[] = []
    for (const pair of coinReveal.pairs) {
      const recomputed = await shortHash(concatBytes([hexToBytes(pair.revealed), hexToBytes(pair.salt)]))
      const other = hexToBytes(pair.otherHash)
      if (pair.bit === 0) {
        hashes.push(recomputed, other)
      } else {
        hashes.push(other, recomputed)
      }
    }

    const coinIdBytes = await sha256(concatBytes(hashes))
    const coinId = bytesToBigInt(coinIdBytes)

    const expectedBits = await challengeBits(coinIdBytes, request.walletIdPaid, request.nonce)
    const bitsMatch = coinReveal.pairs.every((pair, j) => pair.bit === expectedBits[j])
    if (!bitsMatch) {
      return {
        valid: false,
        amount: 0,
        reason: 'Offengelegte Seite passt nicht zur Challenge – möglicher Betrugsversuch.',
      }
    }

    const signature = BigInt(`0x${coinReveal.signature}`)
    const check = modPow(signature, exponent, modulus)
    if (check !== coinId) {
      return { valid: false, amount: 0, reason: 'Ungültige Münzsignatur.' }
    }

    total += coinReveal.value
  }

  if (total !== request.amount) {
    return {
      valid: false,
      amount: total,
      reason: `Summe der Münzen (${total} €) stimmt nicht mit dem Betrag (${request.amount} €) überein.`,
    }
  }

  return { valid: true, amount: total }
}

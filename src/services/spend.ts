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
import type { Coin, ReceivedCoin } from './wallet'
import type { PaymentRequest } from '../models/PaymentRequest'

const NUM_PAIRS = 12

export async function challengeBits(coinIdBytes: Uint8Array, walletIdPaid: string, nonceHex: string): Promise<number[]> {
  // Spezifikation: c = SHA-256(coin_id (32 B) ‖ empfaenger_id (8 B) ‖ nonce (16 B)), alles rohe Bytes – kein Hex-Text
  const input = concatBytes([coinIdBytes, hexToBytes(walletIdPaid), hexToBytes(nonceHex)])
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
  bit?: 0 | 1 // nur intern beim Zahler – wird nicht übertragen und beim Empfänger nie verwendet
  revealed: string // hex, 12 Byte: aⱼ (bit 0) oder aⱼ⊕u (bit 1)
  salt: string // hex, 12 Byte: passendes Salz zur offengelegten Seite
  otherHash: string // hex, 12 Byte: Hash der jeweils NICHT geöffneten Seite
}

export interface CoinReveal {
  value: number
  signature: string
  pairs: PairReveal[]
}

// Was im Zahlungs-QR steht. empfaenger_id, nonce und Betrag kennt der Empfänger selbst.
export interface PaymentProof {
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
  return { coins }
}

export interface VerifyResult {
  valid: boolean
  amount: number
  reason?: string
  coins?: ReceivedCoin[]
}

const COIN_ID_BYTES = 32
const MAX_COIN_ID = 1n << BigInt(COIN_ID_BYTES * 8)

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length)
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return out
}

// Prüfung beim Empfänger. Vertraut vom Zahler NUR den offengelegten Hälften und der Signatur –
// mitgeschickte Bits, Wallet-ID, Nonce oder Betrag werden ignoriert, alles kommt aus der eigenen Anfrage.
// Reihenfolge pro Münze:
//   1. coin_id aus der Signatur: m = signature^e mod N (muss in 32 Byte passen)
//   2. Challenge selbst berechnen: SHA-256(m ‖ eigene empfaenger_id ‖ eigene nonce)
//   3. pro Paar die geöffnete Hälfte hashen und mit dem mitgeschickten Hash zu X_j/Y_j zusammensetzen
//   4. coin_id = SHA-256(X_0 ‖ Y_0 ‖ … ‖ X_11 ‖ Y_11) – muss m sein (= Signatur passt zu genau diesen Hälften)
//   5. coin_id darf lokal noch nicht gesehen worden sein
export async function verifyPaymentProof(
  proof: PaymentProof,
  request: PaymentRequest,
  bankPublicKeyHex: string,
  bankExponent: number,
  seenCoinIds: ReadonlySet<string> = new Set(),
): Promise<VerifyResult> {
  const modulus = BigInt(`0x${bankPublicKeyHex}`)
  const exponent = BigInt(bankExponent)
  const reject = (reason: string): VerifyResult => ({ valid: false, amount: 0, reason })

  const received: ReceivedCoin[] = []
  const inThisPayment = new Set<string>()
  for (const coinReveal of proof.coins) {
    if (coinReveal.pairs.length !== NUM_PAIRS) return reject('Ungültige Anzahl offengelegter Paare.')

    const message = modPow(BigInt(`0x${coinReveal.signature}`), exponent, modulus)
    if (message >= MAX_COIN_ID) return reject('Ungültige Münzsignatur.')
    const signedCoinId = bigIntToBytes(message, COIN_ID_BYTES)

    const bits = await challengeBits(signedCoinId, request.walletIdPaid, request.nonce)

    const hashes: Uint8Array[] = []
    for (let j = 0; j < NUM_PAIRS; j++) {
      const pair = coinReveal.pairs[j]
      const opened = await shortHash(concatBytes([hexToBytes(pair.revealed), hexToBytes(pair.salt)]))
      const other = hexToBytes(pair.otherHash)
      if (bits[j] === 0) hashes.push(opened, other) // X_j geöffnet, Y_j mitgeschickt
      else hashes.push(other, opened) // Y_j geöffnet, X_j mitgeschickt
    }
    const coinIdBytes = await sha256(concatBytes(hashes))
    if (bytesToBigInt(coinIdBytes) !== message) {
      return reject('Offengelegte Hälften passen nicht zur Challenge oder zur Signatur – Zahlung abgelehnt.')
    }

    const coinId = bytesToHex(coinIdBytes)
    if (seenCoinIds.has(coinId) || inThisPayment.has(coinId)) {
      return reject('Diese Münze wurde hier schon einmal angenommen – mögliche Doppelausgabe.')
    }
    inThisPayment.add(coinId)
    received.push({
      coinId,
      value: 1, // nur 1-€-Münzen
      signature: coinReveal.signature,
      nonce: request.nonce,
      pairs: coinReveal.pairs.map(({ revealed, salt, otherHash }) => ({ revealed, salt, otherHash })),
    })
  }

  const total = received.length
  if (total !== request.amount) {
    return {
      valid: false,
      amount: total,
      reason: `Summe der Münzen (${total} €) stimmt nicht mit dem Betrag (${request.amount} €) überein.`,
    }
  }

  return { valid: true, amount: total, coins: received }
}

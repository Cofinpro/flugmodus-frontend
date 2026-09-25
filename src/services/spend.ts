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
  amount: number
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
  return { walletIdPaid: request.walletIdPaid, nonce: request.nonce, amount: request.amount, coins }
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
  if (
    proof.walletIdPaid !== request.walletIdPaid ||
    proof.nonce !== request.nonce ||
    proof.amount !== request.amount
  ) {
    return { valid: false, amount: 0, reason: 'Wallet-ID/Nonce/Betrag stimmen nicht mit der Anfrage überein.' }
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

// ---------- Kompaktes QR-Format für Zahlungsbeweise ----------
// Als JSON wäre der Beweis für 2 Münzen ~3.700 Zeichen lang und passt in keinen QR-Code.
// Binär sind es ~1.150 Byte, als Base64url mit Präfix "FM1." rund 1.540 Zeichen.
// Aufbau (alle Werte big-endian):
//   Kopf:  Version (1) | walletIdPaid (8) | nonce (16) | Betrag (1) | Anzahl Münzen (1)
//   Münze: Wert (1) | Signatur (128) | Challenge-Bits (2, Bit j = Paar j, höchstes Bit zuerst)
//          | 12 × [ revealed (12) | salt (12) | otherHash (12) ]
const PROOF_PREFIX = 'FM1.'
const PROOF_VERSION = 1
const WALLET_ID_BYTES = 8
const NONCE_BYTES = 16
const SIGNATURE_BYTES = 128
const VALUE_BYTES = 12

function fixedHex(hex: string, bytes: number, what: string): Uint8Array {
  const out = hexToBytes(hex.padStart(bytes * 2, '0'))
  if (out.length !== bytes) throw new Error(`${what} hat nicht ${bytes} Byte`)
  return out
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function encodeProof(proof: PaymentProof): string {
  if (proof.amount > 255 || proof.coins.length > 255) throw new Error('Betrag oder Münzanzahl zu groß')
  const chunks: Uint8Array[] = [
    new Uint8Array([PROOF_VERSION]),
    fixedHex(proof.walletIdPaid, WALLET_ID_BYTES, 'walletIdPaid'),
    fixedHex(proof.nonce, NONCE_BYTES, 'nonce'),
    new Uint8Array([proof.amount, proof.coins.length]),
  ]
  for (const coin of proof.coins) {
    if (coin.pairs.length !== NUM_PAIRS) throw new Error('Münze hat nicht 12 Paare')
    const bits = coin.pairs.reduce((acc, pair, j) => acc | (pair.bit << (15 - j)), 0)
    chunks.push(
      new Uint8Array([coin.value]),
      fixedHex(coin.signature, SIGNATURE_BYTES, 'Signatur'),
      new Uint8Array([bits >> 8, bits & 0xff]),
    )
    for (const pair of coin.pairs) {
      chunks.push(
        fixedHex(pair.revealed, VALUE_BYTES, 'revealed'),
        fixedHex(pair.salt, VALUE_BYTES, 'salt'),
        fixedHex(pair.otherHash, VALUE_BYTES, 'otherHash'),
      )
    }
  }
  return PROOF_PREFIX + toBase64Url(concatBytes(chunks))
}

// Liest das kompakte Format; ältere JSON-Beweise werden weiterhin akzeptiert
export function decodeProof(text: string): PaymentProof {
  if (!text.startsWith(PROOF_PREFIX)) return JSON.parse(text) as PaymentProof

  const bytes = fromBase64Url(text.slice(PROOF_PREFIX.length))
  let offset = 0
  const take = (length: number) => {
    if (offset + length > bytes.length) throw new Error('Zahlungsbeweis ist unvollständig')
    const part = bytes.slice(offset, offset + length)
    offset += length
    return part
  }

  if (take(1)[0] !== PROOF_VERSION) throw new Error('Unbekannte Version des Zahlungsbeweises')
  const walletIdPaid = bytesToHex(take(WALLET_ID_BYTES))
  const nonce = bytesToHex(take(NONCE_BYTES))
  const [amount, coinCount] = take(2)

  const coins: CoinReveal[] = []
  for (let c = 0; c < coinCount; c++) {
    const value = take(1)[0]
    const signature = bytesToHex(take(SIGNATURE_BYTES))
    const [high, low] = take(2)
    const bits = (high << 8) | low
    const pairs: PairReveal[] = []
    for (let j = 0; j < NUM_PAIRS; j++) {
      pairs.push({
        bit: ((bits >> (15 - j)) & 1) as 0 | 1,
        revealed: bytesToHex(take(VALUE_BYTES)),
        salt: bytesToHex(take(VALUE_BYTES)),
        otherHash: bytesToHex(take(VALUE_BYTES)),
      })
    }
    coins.push({ value, signature, pairs })
  }
  if (offset !== bytes.length) throw new Error('Zahlungsbeweis hat überzählige Daten')
  return { walletIdPaid, nonce, amount, coins }
}

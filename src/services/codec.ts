// Zahlungs-QR, Format Version 2 (rohe Bytes, big-endian):
//
//   1 Byte   Version 0x02
//   1 Byte   Anzahl Münzen n
//   je Münze 128 Byte Signatur (links mit 0 aufgefüllt)
//            12 × 36 Byte: geöffnete Hälfte (12) ‖ Salt (12) ‖ anderer Hash (12)
//
// Größe: 2 + 560 · n Byte. empfaenger_id, nonce, Betrag, Münzwert und Challenge-Bits fehlen bewusst –
// der Empfänger kennt oder berechnet sie selbst (Betrag = n, nur 1-€-Münzen).
//
// Im QR steht das als Base45 (RFC 9285) mit Präfix "FM2:" im alphanumerischen Modus: der Scanner
// (qr-scanner / BarcodeDetector) liefert nur Text und verliert Rohbytes, die kein gültiges UTF-8 sind.

import { bytesToHex, concatBytes, hexToBytes } from './crypto'
import type { CoinReveal, PaymentProof } from './spend'

export const PAYMENT_PREFIX = 'FM2:'
const VERSION = 0x02
const NUM_PAIRS = 12
const VALUE_BYTES = 12
const SIGNATURE_BYTES = 128
const COIN_BYTES = SIGNATURE_BYTES + NUM_PAIRS * 3 * VALUE_BYTES // 560

// ---------- Base45 (RFC 9285) ----------
const BASE45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'

export function base45Encode(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    let n = bytes[i] * 256 + bytes[i + 1]
    for (let k = 0; k < 3; k++, n = Math.floor(n / 45)) out += BASE45[n % 45]
  }
  if (bytes.length % 2) {
    const n = bytes[bytes.length - 1]
    out += BASE45[n % 45] + BASE45[Math.floor(n / 45)]
  }
  return out
}

export function base45Decode(text: string): Uint8Array {
  const values = Array.from(text, (char) => {
    const value = BASE45.indexOf(char)
    if (value < 0) throw new Error(`Ungültiges Base45-Zeichen: ${JSON.stringify(char)}`)
    return value
  })
  if (values.length % 3 === 1) throw new Error('Ungültige Base45-Länge')
  const out: number[] = []
  for (let i = 0; i < values.length; i += 3) {
    if (i + 2 < values.length) {
      const n = values[i] + values[i + 1] * 45 + values[i + 2] * 45 * 45
      if (n > 0xffff) throw new Error('Ungültiger Base45-Block')
      out.push(n >> 8, n & 0xff)
    } else {
      const n = values[i] + values[i + 1] * 45
      if (n > 0xff) throw new Error('Ungültiger Base45-Block')
      out.push(n)
    }
  }
  return Uint8Array.from(out)
}

// ---------- Zahlungsbeweis ----------
function fixedHex(hex: string, bytes: number, what: string): Uint8Array {
  const out = hexToBytes(hex.padStart(bytes * 2, '0'))
  if (out.length !== bytes) throw new Error(`${what} hat nicht ${bytes} Byte`)
  return out
}

export function encodePaymentBytes(proof: PaymentProof): Uint8Array {
  const n = proof.coins.length
  if (n < 1 || n > 255) throw new Error('Ungültige Anzahl Münzen')
  const chunks: Uint8Array[] = [new Uint8Array([VERSION, n])]
  for (const coin of proof.coins) {
    if (coin.pairs.length !== NUM_PAIRS) throw new Error('Münze hat nicht 12 Paare')
    chunks.push(fixedHex(coin.signature, SIGNATURE_BYTES, 'Signatur'))
    for (const pair of coin.pairs) {
      chunks.push(
        fixedHex(pair.revealed, VALUE_BYTES, 'geöffnete Hälfte'),
        fixedHex(pair.salt, VALUE_BYTES, 'Salt'),
        fixedHex(pair.otherHash, VALUE_BYTES, 'anderer Hash'),
      )
    }
  }
  return concatBytes(chunks)
}

export function decodePaymentBytes(bytes: Uint8Array): PaymentProof {
  if (bytes.length < 2 || bytes[0] !== VERSION) throw new Error('Unbekannte Version des Zahlungs-QR')
  const n = bytes[1]
  if (n < 1 || bytes.length !== 2 + COIN_BYTES * n) throw new Error('Zahlungs-QR hat die falsche Länge')

  let offset = 2
  const take = (length: number) => bytesToHex(bytes.slice(offset, (offset += length)))
  const coins: CoinReveal[] = []
  for (let c = 0; c < n; c++) {
    const signature = take(SIGNATURE_BYTES)
    const pairs = Array.from({ length: NUM_PAIRS }, () => ({
      revealed: take(VALUE_BYTES),
      salt: take(VALUE_BYTES),
      otherHash: take(VALUE_BYTES),
    }))
    coins.push({ value: 1, signature, pairs })
  }
  return { coins }
}

export function encodePayment(proof: PaymentProof): string {
  return PAYMENT_PREFIX + base45Encode(encodePaymentBytes(proof))
}

export function decodePayment(text: string): PaymentProof {
  if (!text.startsWith(PAYMENT_PREFIX)) throw new Error('Kein Zahlungs-QR (Präfix FM2: fehlt)')
  return decodePaymentBytes(base45Decode(text.slice(PAYMENT_PREFIX.length)))
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPaymentProof, challengeBits, verifyPaymentProof, type PaymentProof } from '../src/services/spend.ts'
import { bytesToHex, concatBytes, hexToBytes, sha256, shortHash, xorBytes } from '../src/services/crypto.ts'
import type { PaymentRequest } from '../src/models/PaymentRequest.ts'
import { E, IDENTITY, IDENTITY_HEX, TEST_N_HEX, makeCoin } from './fixtures.ts'
import type { Coin } from '../src/services/wallet.ts'

const request: PaymentRequest = {
  walletIdPaid: '0a36ea6680542fe2',
  nonce: '022f9452925e88070f0b65a68f16f24d',
  amount: 1,
  merchantName: 'Kiosk Dojo',
}

// So hat der fehlerhafte Zahler die Bits gebildet: empfaenger_id als Hex-TEXT gehasht
async function buggyBits(coin: Coin): Promise<number[]> {
  const digest = await sha256(concatBytes([coin.coinIdBytes, new TextEncoder().encode(request.walletIdPaid), hexToBytes(request.nonce)]))
  return Array.from({ length: 12 }, (_, j) => (digest[j >> 3] >> (7 - (j & 7))) & 1)
}

// Mit Wahrscheinlichkeit 2⁻¹² sind zwei Challenges zufällig gleich – dann wäre die Münze zu Recht gültig
// (Eigenschaft des Protokolls). Für die Ablehnungs-Tests daher nur Münzen, bei denen sich die Bits unterscheiden.
async function coinWhere(differs: (coin: Coin) => Promise<boolean>): Promise<Coin> {
  for (;;) {
    const coin = await makeCoin()
    if (await differs(coin)) return coin
  }
}
const sameBits = (a: number[], b: number[]) => a.join('') === b.join('')

async function buggyProof(coin: Coin): Promise<PaymentProof> {
  const bits = await buggyBits(coin)
  const pairs = []
  for (let j = 0; j < 12; j++) {
    const bit = bits[j] as 0 | 1
    if (bit === 0) {
      const other = await shortHash(concatBytes([xorBytes(coin.masks[j], IDENTITY), coin.rightSalts[j]]))
      pairs.push({ bit, revealed: bytesToHex(coin.masks[j]), salt: bytesToHex(coin.leftSalts[j]), otherHash: bytesToHex(other) })
    } else {
      const other = await shortHash(concatBytes([coin.masks[j], coin.leftSalts[j]]))
      pairs.push({ bit, revealed: bytesToHex(xorBytes(coin.masks[j], IDENTITY)), salt: bytesToHex(coin.rightSalts[j]), otherHash: bytesToHex(other) })
    }
  }
  return { coins: [{ value: 1, signature: coin.signature.toString(16), pairs }] }
}

test('korrekte Zahlung wird angenommen', async () => {
  const proof = await buildPaymentProof([await makeCoin()], IDENTITY_HEX, request)
  const result = await verifyPaymentProof(proof, request, TEST_N_HEX, E)
  assert.equal(result.valid, true, result.reason)
  assert.equal(result.amount, 1)
})

test('angenommene Münze trägt das Transcript für die Bank (nonce + 12 Paare)', async () => {
  const proof = await buildPaymentProof([await makeCoin()], IDENTITY_HEX, request)
  const result = await verifyPaymentProof(proof, request, TEST_N_HEX, E)
  const [coin] = result.coins ?? []
  assert.equal(coin.nonce, request.nonce)
  assert.equal(coin.pairs?.length, 12)
  assert.deepEqual(coin.pairs?.[0], { revealed: proof.coins[0].pairs[0].revealed, salt: proof.coins[0].pairs[0].salt, otherHash: proof.coins[0].pairs[0].otherHash })
})

test('QR mit den falschen Challenge-Bits aus Teil 1 wird abgelehnt', async () => {
  const coin = await coinWhere(async (c) => !sameBits(await buggyBits(c), await challengeBits(c.coinIdBytes, request.walletIdPaid, request.nonce)))
  const proof = await buggyProof(coin)
  const result = await verifyPaymentProof(proof, request, TEST_N_HEX, E)
  assert.equal(result.valid, false)
  assert.match(result.reason ?? '', /Challenge/)
})

test('mitgeschickte Bits werden ignoriert, nicht vertraut', async () => {
  const proof = await buildPaymentProof([await makeCoin()], IDENTITY_HEX, request)
  for (const pair of proof.coins[0].pairs) pair.bit = (1 - (pair.bit ?? 0)) as 0 | 1 // alle Bits verfälscht
  const result = await verifyPaymentProof(proof, request, TEST_N_HEX, E)
  assert.equal(result.valid, true, 'Bits im Beweis dürfen keine Rolle spielen')
})

test('Beweis für eine andere Anfrage (andere nonce) wird abgelehnt', async () => {
  const otherNonce = '00'.repeat(16)
  const coin = await coinWhere(async (c) =>
    !sameBits(await challengeBits(c.coinIdBytes, request.walletIdPaid, otherNonce), await challengeBits(c.coinIdBytes, request.walletIdPaid, request.nonce)),
  )
  const proof = await buildPaymentProof([coin], IDENTITY_HEX, { ...request, nonce: otherNonce })
  const result = await verifyPaymentProof(proof, request, TEST_N_HEX, E)
  assert.equal(result.valid, false)
})

test('schon gesehene coin_id wird abgelehnt', async () => {
  const coin = await makeCoin()
  const proof = await buildPaymentProof([coin], IDENTITY_HEX, request)
  const result = await verifyPaymentProof(proof, request, TEST_N_HEX, E, new Set([bytesToHex(coin.coinIdBytes)]))
  assert.equal(result.valid, false)
  assert.match(result.reason ?? '', /schon einmal/)
})

test('gefälschte Signatur wird abgelehnt', async () => {
  const proof = await buildPaymentProof([await makeCoin()], IDENTITY_HEX, request)
  proof.coins[0].signature = (BigInt('0x' + proof.coins[0].signature) + 1n).toString(16)
  const result = await verifyPaymentProof(proof, request, TEST_N_HEX, E)
  assert.equal(result.valid, false)
})

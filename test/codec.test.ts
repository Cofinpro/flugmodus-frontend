import { test } from 'node:test'
import assert from 'node:assert/strict'
import { base45Decode, base45Encode, decodePayment, decodePaymentBytes, encodePayment, encodePaymentBytes } from '../src/services/codec.ts'
import { buildPaymentProof, verifyPaymentProof, type PaymentProof } from '../src/services/spend.ts'
import { E, IDENTITY_HEX, TEST_N_HEX, makeCoin } from './fixtures.ts'

const request = { walletIdPaid: '0a36ea6680542fe2', nonce: '022f9452925e88070f0b65a68f16f24d', amount: 1, merchantName: 'Kiosk Dojo' }

async function proofWith(n: number) {
  const coins = await Promise.all(Array.from({ length: n }, makeCoin))
  return buildPaymentProof(coins, IDENTITY_HEX, { ...request, amount: n })
}
// Vergleich ohne die nur intern genutzten Bits; Signatur als Zahl (Auffüllen mit Nullen ist erlaubt)
const normalize = (proof: PaymentProof) =>
  proof.coins.map((coin) => ({
    value: coin.value,
    signature: BigInt('0x' + coin.signature),
    pairs: coin.pairs.map(({ revealed, salt, otherHash }) => ({ revealed, salt, otherHash })),
  }))

test('Base45 entspricht den Beispielen aus RFC 9285', () => {
  const enc = (s: string) => base45Encode(new TextEncoder().encode(s))
  assert.equal(enc('AB'), 'BB8')
  assert.equal(enc('Hello!!'), '%69 VD92EX0')
  assert.equal(enc('base-45'), 'UJCLQE7W581')
  assert.equal(new TextDecoder().decode(base45Decode('QED8WEX0')), 'ietf!')
})

for (const n of [1, 2]) {
  test(`Roundtrip encode → decode ist identisch (n = ${n}) und hat 2 + 560 · n Byte`, async () => {
    const proof = await proofWith(n)
    assert.equal(encodePaymentBytes(proof).length, 2 + 560 * n)
    const decoded = decodePayment(encodePayment(proof))
    assert.deepEqual(normalize(decoded), normalize(proof))
    assert.deepEqual(normalize(decodePaymentBytes(encodePaymentBytes(proof))), normalize(proof))
  })

  test(`dekodierter QR besteht die Empfänger-Prüfung (n = ${n})`, async () => {
    const decoded = decodePayment(encodePayment(await proofWith(n)))
    const result = await verifyPaymentProof(decoded, { ...request, amount: n }, TEST_N_HEX, E)
    assert.equal(result.valid, true, result.reason)
    assert.equal(result.amount, n)
  })
}

test('QR-Text nutzt nur den alphanumerischen QR-Zeichensatz', async () => {
  assert.match(encodePayment(await proofWith(2)), /^[0-9A-Z $%*+\-./:]+$/)
})

test('merchantName geht nicht in die Prüfung ein', async () => {
  const decoded = decodePayment(encodePayment(await proofWith(1)))
  const result = await verifyPaymentProof(decoded, { ...request, merchantName: 'Irgendwer anders' }, TEST_N_HEX, E)
  assert.equal(result.valid, true, result.reason)
})

test('falsche Version, Länge oder Präfix werden abgelehnt', async () => {
  const bytes = encodePaymentBytes(await proofWith(1))
  assert.throws(() => decodePaymentBytes(Uint8Array.from([0x01, ...bytes.slice(1)])), /Version/)
  assert.throws(() => decodePaymentBytes(bytes.slice(0, -1)), /Länge/)
  assert.throws(() => decodePayment('FM1.' + base45Encode(bytes)), /Präfix/)
})

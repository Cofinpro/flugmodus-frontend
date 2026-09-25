import { test } from 'node:test'
import assert from 'node:assert/strict'
import { challengeBits } from '../src/services/spend.ts'
import { hexToBytes } from '../src/services/crypto.ts'

// Testvektor aus einem echten Zahlungs-QR (Spezifikation: c = SHA-256(coin_id ‖ empfaenger_id ‖ nonce), rohe Bytes)
const EMPFAENGER_ID = '0a36ea6680542fe2'
const NONCE = '022f9452925e88070f0b65a68f16f24d'
const COIN_ID = 'da9e0d7b8abb28fc5b9cef14ff2a1640c5500bac4fad57bedb8862aa6da3b3b6'

test('Challenge-Bits des Zahlers entsprechen der Spezifikation (Testvektor)', async () => {
  const bits = await challengeBits(hexToBytes(COIN_ID), EMPFAENGER_ID, NONCE)
  assert.deepEqual(bits, [0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1])
})

// NUR für Tests: eigener RSA-1024-Schlüssel (e = 65537), hat nichts mit dem Bank-Schlüssel zu tun
import { bytesToBigInt, computeCoinId, modPow, randomBytes } from '../src/services/crypto.ts'
import type { Coin } from '../src/services/wallet.ts'

export const TEST_N_HEX = 'b5fd9665edeb8da0405c8e1c057a361aaef7ab4fe56579e3684d1740fc347f1a542ea0ad4cc3f69003b48bcf6f1a3f70bc67ff61b64c6af1466c63a3dc61a35ade3df79e8f225d327ef76c75942a739cca0b734acdf2e46908fec6864df3bd549a56ec35f7e926982670d27d5004f2678f03a20a90ff3cf762f3ee0b18b8a6bb'
const TEST_D = BigInt('0x36c86f4d9fa118b0f4aee7d8678db25bb5efb81204ebd7152d80874f789c14e6c810812da9be13aaa672e2e33e7e983a477cc6d3931ccdd4736e8d4ff6372e04da6b663b864c164e6095d4d2c24c1dff3a3055deae8002cd7acb356fa7361771e8bb91578b93eda9933345d161bc27291a932b3898df669d652c8dcc38b44c81')
export const E = 65537

export const IDENTITY = randomBytes(12)
export const IDENTITY_HEX = Array.from(IDENTITY, (b) => b.toString(16).padStart(2, '0')).join('')

// Münze wie nach der Abhebung: zufällige Masken/Salze, coin_id per Wallet-Funktion, von der Test-„Bank“ signiert
export async function makeCoin(): Promise<Coin> {
  const pairs = (length: number) => Array.from({ length }, () => randomBytes(12))
  const masks = pairs(12)
  const leftSalts = pairs(12)
  const rightSalts = pairs(12)
  const coinIdBytes = await computeCoinId(IDENTITY, masks, leftSalts, rightSalts)
  const signature = modPow(bytesToBigInt(coinIdBytes), TEST_D, BigInt('0x' + TEST_N_HEX))
  return { value: 1, coinIdBytes, signature, masks, leftSalts, rightSalts }
}

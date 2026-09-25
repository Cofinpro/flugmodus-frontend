export const VALUE_BYTES = 12

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? `0${hex}` : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (const byte of bytes) result = (result << 8n) | BigInt(byte)
  return result
}

export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i]
  return out
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

export async function shortHash(bytes: Uint8Array): Promise<Uint8Array> {
  return (await sha256(bytes)).slice(0, VALUE_BYTES)
}

export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n
  let b = base % modulus
  let e = exponent
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus
    e >>= 1n
    b = (b * b) % modulus
  }
  return result
}

export function gcd(a: bigint, b: bigint): bigint {
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

// Erweiterter Euklidischer Algorithmus: liefert a⁻¹ mod m.
export function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [a, m]
  let [oldS, s] = [1n, 0n]
  while (r !== 0n) {
    const q = oldR / r
    ;[oldR, r] = [r, oldR - q * r]
    ;[oldS, s] = [s, oldS - q * s]
  }
  return ((oldS % m) + m) % m
}

export function randomBigIntBelow(max: bigint): bigint {
  const byteLength = (max.toString(16).length + 1) >> 1
  let value: bigint
  do {
    value = bytesToBigInt(randomBytes(byteLength))
  } while (value <= 1n || value >= max)
  return value
}

// coin_id = SHA-256(X_0 ‖ Y_0 ‖ … ‖ X_11 ‖ Y_11), X_j = H(mask_j ‖ left_j), Y_j = H((mask_j ⊕ u) ‖ right_j) – 32 rohe Bytes
export async function computeCoinId(
  identity: Uint8Array,
  masks: Uint8Array[],
  leftSalts: Uint8Array[],
  rightSalts: Uint8Array[],
): Promise<Uint8Array> {
  const pairHashes: Uint8Array[] = []
  for (let pair = 0; pair < masks.length; pair++) {
    pairHashes.push(await shortHash(concatBytes([masks[pair], leftSalts[pair]])))
    pairHashes.push(await shortHash(concatBytes([xorBytes(masks[pair], identity), rightSalts[pair]])))
  }
  return sha256(concatBytes(pairHashes))
}

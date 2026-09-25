import { backendUrl } from './backend'

const NUM_CANDIDATES = 100
const NUM_PAIRS = 12
const VALUE_BYTES = 12
const RSA_PUBLIC_EXPONENT = 65537n

// Öffentlicher RSA-Modulus für coin_value=1, aus flugmodus-backend/keys/keys.json
// (nur das öffentliche "modulus"-Feld, nie der private Exponent).
const MODULUS = BigInt(
  '0xc6e25039b9fa686d28954614b8ab80889b704e716d231105972773768e4c79a2ec25ea4c3af2b14218c8028a6b7e8b4eb184c8a48bf82de2fdced53aaa5b0ee530cbce6c19e2516d0ede85b7ca5bc68a08259f42f64511dc7245d4f09e408fc18daca890d0be16617a6ddc980765b65160b92065aa13b53d1a6b9c7d9ed98943',
)

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 ? `0${hex}` : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (const byte of bytes) result = (result << 8n) | BigInt(byte)
  return result
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i]
  return out
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

async function shortHash(bytes: Uint8Array): Promise<Uint8Array> {
  return (await sha256(bytes)).slice(0, VALUE_BYTES)
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
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

function gcd(a: bigint, b: bigint): bigint {
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

function randomBigIntBelow(max: bigint): bigint {
  const byteLength = (max.toString(16).length + 1) >> 1
  let value: bigint
  do {
    value = bytesToBigInt(randomBytes(byteLength))
  } while (value <= 1n || value >= max)
  return value
}

interface Candidate {
  masks: Uint8Array[]
  leftSalts: Uint8Array[]
  rightSalts: Uint8Array[]
  blindingFactor: bigint
  blinded: bigint
}

async function buildCandidate(identity: Uint8Array): Promise<Candidate> {
  const masks = Array.from({ length: NUM_PAIRS }, () => randomBytes(VALUE_BYTES))
  const leftSalts = Array.from({ length: NUM_PAIRS }, () => randomBytes(VALUE_BYTES))
  const rightSalts = Array.from({ length: NUM_PAIRS }, () => randomBytes(VALUE_BYTES))

  const pairHashes: Uint8Array[] = []
  for (let pair = 0; pair < NUM_PAIRS; pair++) {
    pairHashes.push(await shortHash(concatBytes([masks[pair], leftSalts[pair]])))
    pairHashes.push(await shortHash(concatBytes([xorBytes(masks[pair], identity), rightSalts[pair]])))
  }
  const coinId = bytesToBigInt(await sha256(concatBytes(pairHashes)))

  let blindingFactor: bigint
  do {
    blindingFactor = randomBigIntBelow(MODULUS)
  } while (gcd(blindingFactor, MODULUS) !== 1n)

  const blinded = (coinId * modPow(blindingFactor, RSA_PUBLIC_EXPONENT, MODULUS)) % MODULUS

  return { masks, leftSalts, rightSalts, blindingFactor, blinded }
}

export interface IssueSession {
  sessionId: string
  keptCandidateIndex: number
  candidates: Candidate[]
}

export async function issueStart(accountId: string, accountUHex: string): Promise<IssueSession> {
  const identity = hexToBytes(accountUHex)
  const candidates = await Promise.all(
    Array.from({ length: NUM_CANDIDATES }, () => buildCandidate(identity)),
  )

  const response = await fetch(`${backendUrl.value}/api/issue/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id: accountId,
      coin_value: 1,
      blinded_candidates: candidates.map((candidate) => candidate.blinded.toString(16)),
    }),
  })

  if (!response.ok) {
    throw new Error(`Aufladen fehlgeschlagen (HTTP ${response.status})`)
  }

  const data = await response.json()
  return { sessionId: data.session_id, keptCandidateIndex: data.kept_candidate_index, candidates }
}

export interface IssueFinishResult {
  blindSignature: string
}

export async function issueFinish(session: IssueSession): Promise<IssueFinishResult> {
  const candidateOpenings = session.candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ index }) => index !== session.keptCandidateIndex)
    .map(({ candidate, index }) => ({
      candidate_index: index,
      masks: candidate.masks.map(bytesToHex),
      left_salts: candidate.leftSalts.map(bytesToHex),
      right_salts: candidate.rightSalts.map(bytesToHex),
      blinding_factor: candidate.blindingFactor.toString(16),
    }))

  const response = await fetch(`${backendUrl.value}/api/issue/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: session.sessionId,
      candidate_openings: candidateOpenings,
    }),
  })

  if (!response.ok) {
    throw new Error(`Abschluss fehlgeschlagen (HTTP ${response.status})`)
  }

  const data = await response.json()
  return { blindSignature: data.blind_signature }
}

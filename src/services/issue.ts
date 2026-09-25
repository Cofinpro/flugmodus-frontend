import { backendUrl } from './backend'
import { addCoin, type Coin } from './wallet'
import {
  bytesToBigInt,
  bytesToHex,
  computeCoinId,
  gcd,
  hexToBytes,
  modInverse,
  modPow,
  randomBigIntBelow,
  randomBytes,
  sha256,
  shortHash,
  xorBytes,
} from './crypto'

const NUM_CANDIDATES = 100
const NUM_PAIRS = 12
const VALUE_BYTES = 12

interface Candidate {
  masks: Uint8Array[]
  leftSalts: Uint8Array[]
  rightSalts: Uint8Array[]
  blindingFactor: bigint
  blinded: bigint
  coinIdBytes: Uint8Array
}

async function buildCandidate(identity: Uint8Array, modulus: bigint, exponent: bigint): Promise<Candidate> {
  const masks = Array.from({ length: NUM_PAIRS }, () => randomBytes(VALUE_BYTES))
  const leftSalts = Array.from({ length: NUM_PAIRS }, () => randomBytes(VALUE_BYTES))
  const rightSalts = Array.from({ length: NUM_PAIRS }, () => randomBytes(VALUE_BYTES))

  const coinIdBytes = await computeCoinId(identity, masks, leftSalts, rightSalts)
  const coinId = bytesToBigInt(coinIdBytes)

  let blindingFactor: bigint
  do {
    blindingFactor = randomBigIntBelow(modulus)
  } while (gcd(blindingFactor, modulus) !== 1n)

  const blinded = (coinId * modPow(blindingFactor, exponent, modulus)) % modulus

  return { masks, leftSalts, rightSalts, blindingFactor, blinded, coinIdBytes }
}

export interface IssueSession {
  sessionId: string
  keptCandidateIndex: number
  candidates: Candidate[]
  modulus: bigint
  exponent: bigint
}

export async function issueStart(
  accountId: string,
  accountUHex: string,
  bankPublicKeyHex: string,
  bankExponent: number,
): Promise<IssueSession> {
  if (!bankPublicKeyHex || !bankExponent) {
    throw new Error(
      'Öffentlicher Bank-Schlüssel fehlt in der Konto-Antwort (bank_public_key/bank_exponent). Backend noch nicht aktuell?',
    )
  }

  const modulus = BigInt(`0x${bankPublicKeyHex}`)
  const exponent = BigInt(bankExponent)
  const identity = hexToBytes(accountUHex)
  const candidates = await Promise.all(
    Array.from({ length: NUM_CANDIDATES }, () => buildCandidate(identity, modulus, exponent)),
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
  return {
    sessionId: data.session_id,
    keptCandidateIndex: data.kept_candidate_index,
    candidates,
    modulus,
    exponent,
  }
}

export async function issueFinish(session: IssueSession): Promise<Coin> {
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
  const kept = session.candidates[session.keptCandidateIndex]
  const blindSignature = BigInt(`0x${data.blind_signature}`)
  const blindingFactorInverse = modInverse(kept.blindingFactor, session.modulus)
  const signature = (blindSignature * blindingFactorInverse) % session.modulus

  const coin: Coin = {
    value: 1,
    coinIdBytes: kept.coinIdBytes,
    signature,
    masks: kept.masks,
    leftSalts: kept.leftSalts,
    rightSalts: kept.rightSalts,
  }
  addCoin(coin)
  return coin
}

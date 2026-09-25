import { backendUrl } from './backend'

const NUM_CANDIDATES = 100

function randomHex(byteLength: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(byteLength)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export interface IssueStartResult {
  sessionId: string
  keptCandidateIndex: number
}

export async function issueStart(accountId: string): Promise<IssueStartResult> {
  // Platzhalter: echtes RSA-Blinding braucht den öffentlichen Modulus vom Backend,
  // der aktuell über keine Route verfügbar ist.
  const blindedCandidates = Array.from({ length: NUM_CANDIDATES }, () => randomHex(128))

  const response = await fetch(`${backendUrl.value}/api/issue/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id: accountId,
      coin_value: 1,
      blinded_candidates: blindedCandidates,
    }),
  })

  if (!response.ok) {
    throw new Error(`Aufladen fehlgeschlagen (HTTP ${response.status})`)
  }

  const data = await response.json()
  return { sessionId: data.session_id, keptCandidateIndex: data.kept_candidate_index }
}

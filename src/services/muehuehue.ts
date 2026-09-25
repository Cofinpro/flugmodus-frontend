// „Muehuehue“: kurzes, hämisches Glucksen als WAV, einmal im Browser berechnet.
// Bewusst <audio> statt Web Audio: iOS stellt Web Audio im Lautlos-Modus stumm, <audio> nicht,
// und play() läuft zuverlässig direkt im Tap.

const RATE = 22050

function render(): ArrayBuffer {
  const syllables = 4
  const step = 0.16 // Sekunden zwischen den Silben
  const length = 0.15 // Dauer einer Silbe
  const total = Math.ceil((step * (syllables - 1) + length + 0.05) * RATE)
  const samples = new Float32Array(total)
  for (let i = 0; i < syllables; i++) {
    const start = Math.floor(i * step * RATE)
    const base = 300 - i * 28 // jede Silbe etwas tiefer
    let phase = 0
    for (let n = 0; n < length * RATE; n++) {
      const t = n / RATE
      const glide = base * (1.25 - 0.25 * Math.min(1, t / 0.12)) // von oben herab gleiten
      const freq = glide + 12 * Math.sin(2 * Math.PI * 22 * t) // Vibrato
      phase += freq / RATE
      const saw = 2 * (phase - Math.floor(phase + 0.5)) // Sägezahn
      const env = Math.min(1, t / 0.03) * Math.max(0, 1 - (t - 0.03) / (length - 0.03)) // An- und Abschwellen
      samples[start + n] += saw * env * 0.35
    }
  }
  // 16-Bit-Mono-WAV
  const data = new DataView(new ArrayBuffer(44 + total * 2))
  const text = (offset: number, value: string) => [...value].forEach((c, i) => data.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  data.setUint32(4, 36 + total * 2, true)
  text(8, 'WAVEfmt ')
  data.setUint32(16, 16, true)
  data.setUint16(20, 1, true)
  data.setUint16(22, 1, true)
  data.setUint32(24, RATE, true)
  data.setUint32(28, RATE * 2, true)
  data.setUint16(32, 2, true)
  data.setUint16(34, 16, true)
  text(36, 'data')
  data.setUint32(40, total * 2, true)
  for (let n = 0; n < total; n++) data.setInt16(44 + n * 2, Math.max(-1, Math.min(1, samples[n])) * 0x7fff, true)
  return data.buffer
}

let url = ''
export function muehuehueWav(): Uint8Array {
  return new Uint8Array(render())
}

// Im Tap aufrufen – die Datei wird beim ersten Mal erzeugt und dann wiederverwendet
export function playMuehuehue() {
  try {
    url ||= URL.createObjectURL(new Blob([render()], { type: 'audio/wav' }))
    const audio = new Audio(url)
    audio.play().catch(() => {}) // Ton ist Beiwerk – schlägt er fehl, läuft der Rest normal weiter
  } catch {
    // z. B. kein Audio im Browser
  }
}

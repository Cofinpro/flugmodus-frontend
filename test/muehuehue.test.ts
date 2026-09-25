import { test } from 'node:test'
import assert from 'node:assert/strict'
import { muehuehueWav } from '../src/services/muehuehue.ts'

test('muehuehue ist eine gültige 16-Bit-Mono-WAV mit hörbarem Inhalt', () => {
  const wav = muehuehueWav()
  const view = new DataView(wav.buffer)
  const text = (offset: number, n: number) => String.fromCharCode(...wav.slice(offset, offset + n))
  assert.equal(text(0, 4), 'RIFF')
  assert.equal(text(8, 4), 'WAVE')
  assert.equal(view.getUint16(22, true), 1) // mono
  assert.equal(view.getUint16(34, true), 16) // 16 Bit
  const seconds = view.getUint32(40, true) / 2 / view.getUint32(24, true)
  assert.ok(seconds > 0.5 && seconds < 1, `Dauer ${seconds} s`)
  let peak = 0
  for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)))
  assert.ok(peak > 5000, `zu leise: ${peak}`)
})

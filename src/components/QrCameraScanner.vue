<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import QrScanner from 'qr-scanner'
import QrScannerWorkerPath from 'qr-scanner/qr-scanner-worker.min.js?url'
import { backendUrl, isHttpUrl, setBackendUrl } from '../services/backend'
import { createAccount } from '../services/account'
import { pay } from '../services/payment'
import type { Account } from '../models/Account'
import type { Token } from '../models/Token'
import type { Rfp } from '../models/Rfp'
import type { Pair } from '../models/Pair'

QrScanner.WORKER_PATH = QrScannerWorkerPath

const emit = defineEmits<{ decode: [string] }>()

const videoRef = ref<HTMLVideoElement | null>(null)
const result = ref('')
const error = ref('')
const scanning = ref(false)
let scanner: QrScanner | null = null

const account = ref<Account | null>(null)
const token = ref<Token | null>(null)
const scannedRfp = ref<Rfp | null>(null)
const pair = ref<Pair | null>(null)

function newAccount() {
  const created = createAccount()
  account.value = created.account
  token.value = created.token
  pair.value = null
}

function handleResult(data: string) {
  result.value = data
  try {
    scannedRfp.value = JSON.parse(data) as Rfp
  } catch {
    scannedRfp.value = null
  }
}

function doPay() {
  if (!token.value || token.value.spent || !scannedRfp.value) return
  pair.value = pay(token.value, scannedRfp.value)
  scannedRfp.value.pairReq.push(pair.value)
  token.value.spent = true
}

function fraudPay() {
  if (!token.value || !token.value.spent || !scannedRfp.value) return
  pair.value = pay(token.value, scannedRfp.value)
  scannedRfp.value.pairReq.push(pair.value)
}

async function start() {
  error.value = ''
  if (!videoRef.value) return

  scanner = new QrScanner(
    videoRef.value,
    (r) => {
      result.value = r.data
      emit('decode', r.data)
      handleResult(r.data)
      if (isHttpUrl(r.data)) {
        setBackendUrl(r.data)
      }
    },
    { highlightScanRegion: true, highlightCodeOutline: true },
  )

  try {
    await scanner.start()
    scanning.value = true
  } catch (e) {
    error.value = `Kamera-Zugriff fehlgeschlagen: ${(e as Error).message}`
  }
}

function stop() {
  scanner?.stop()
  scanning.value = false
}

onBeforeUnmount(() => {
  scanner?.destroy()
  scanner = null
})
</script>

<template>
  <div class="qr-camera">
    <video ref="videoRef" class="qr-camera__preview"></video>
    <button class="btn btn--ghost" v-if="!scanning" @click="start">Kamera starten</button>
    <button class="btn btn--ghost" v-else @click="stop">Kamera stoppen</button>
    <p v-if="error" class="step__error">{{ error }}</p>
  </div>
  <section>
    <h2>Konto</h2>
    <button @click="newAccount">Eigenes Konto erstellen</button>
    <p v-if="account">Wallet-ID: {{ account.walletId }}</p>
    <p v-if="token">Signature: {{ token.signature }}</p>
    <p v-if="token">Spent: {{ token.spent }}</p>

    <h2>QR-Code Scanner</h2>
    <video ref="videoRef" class="preview"></video>
    <div>
      <button v-if="!scanning" @click="start">Kamera starten</button>
      <button v-else @click="stop">Kamera stoppen</button>
    </div>
    <p v-if="error">{{ error }}</p>
    <p v-else>Ergebnis: {{ result || '–' }}</p>
    <p>Backend-URL: {{ backendUrl || 'nicht konfiguriert' }}</p>

    <h2>Bezahlen</h2>
    <button :disabled="!token || token.spent || !scannedRfp" @click="doPay">Bezahlen</button>
    <br />
    <button
      class="fraud"
      :disabled="!token || !token.spent || !scannedRfp"
      @click="fraudPay"
    >
      🚨 Coin nochmal ausgeben (Fraud-Demo)
    </button>
    <pre v-if="pair">{{ pair }}</pre>
  </section>
</template>

<style scoped>
.qr-camera {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.qr-camera__preview {
  width: 100%;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
  aspect-ratio: 1 / 1;
  object-fit: cover;
}

.fraud {
  border: 2px solid red;
  color: red;
  font-weight: bold;
}
</style>

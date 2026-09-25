<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
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

// autoStart: Kamera startet sofort, ohne Start/Stopp-Buttons
const props = defineProps<{ autoStart?: boolean }>()
const emit = defineEmits<{ decode: [string]; error: [string] }>()

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
    emit('error', error.value)
  }
}

function stop() {
  scanner?.stop()
  scanning.value = false
}

onMounted(() => {
  if (props.autoStart) start()
})

onBeforeUnmount(() => {
  scanner?.destroy()
  scanner = null
})
</script>

<template>
  <div class="qr-camera">
    <div class="qr-camera__frame">
      <video ref="videoRef" class="qr-camera__preview"></video>
    </div>
    <template v-if="!autoStart || error">
      <button class="btn btn--ghost" v-if="!scanning" @click="start">Kamera starten</button>
      <button class="btn btn--ghost" v-else @click="stop">Kamera stoppen</button>
    </template>
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
  gap: 14px;
}

/* wie .fm-qr: weißer Rahmen, Tintenlinie, Amber-Ecken */
.qr-camera__frame {
  position: relative;
  padding: 10px;
  border-radius: 20px;
  background: #fff;
  box-shadow: inset 0 0 0 var(--fm-line) var(--fm-ink), 0 30px 60px rgb(0 0 0 / 0.45);
}

.qr-camera__frame::before,
.qr-camera__frame::after {
  content: '';
  position: absolute;
  width: 30px;
  height: 30px;
  border: 3px solid var(--fm-amber-deep);
}

.qr-camera__frame::before {
  top: -9px;
  left: -9px;
  border-right: 0;
  border-bottom: 0;
  border-radius: 12px 0 0 0;
}

.qr-camera__frame::after {
  right: -9px;
  bottom: -9px;
  border-left: 0;
  border-top: 0;
  border-radius: 0 0 12px 0;
}

.qr-camera__preview {
  display: block;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: var(--fm-ink);
  aspect-ratio: 1 / 1;
  object-fit: cover;
}

.fraud {
  border: 2px solid red;
  color: red;
  font-weight: bold;
}
</style>

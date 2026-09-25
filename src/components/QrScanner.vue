<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import QrScanner from 'qr-scanner'
import QrScannerWorkerPath from 'qr-scanner/qr-scanner-worker.min.js?url'
import { backendUrl, isHttpUrl, setBackendUrl } from '../services/backend'

QrScanner.WORKER_PATH = QrScannerWorkerPath

const videoRef = ref<HTMLVideoElement | null>(null)
const result = ref('')
const error = ref('')
const scanning = ref(false)
let scanner: QrScanner | null = null

async function start() {
  error.value = ''
  if (!videoRef.value) return

  scanner = new QrScanner(
    videoRef.value,
    (r) => {
      result.value = r.data
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
  <section>
    <h2>QR-Code Scanner</h2>
    <video ref="videoRef" class="preview"></video>
    <div>
      <button v-if="!scanning" @click="start">Kamera starten</button>
      <button v-else @click="stop">Kamera stoppen</button>
    </div>
    <p v-if="error">{{ error }}</p>
    <p v-else>Ergebnis: {{ result || '–' }}</p>
    <p>Backend-URL: {{ backendUrl || 'nicht konfiguriert' }}</p>
  </section>
</template>

<style scoped>
.preview {
  width: 100%;
  max-width: 320px;
}
</style>

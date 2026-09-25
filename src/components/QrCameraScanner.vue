<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import QrScanner from 'qr-scanner'
import QrScannerWorkerPath from 'qr-scanner/qr-scanner-worker.min.js?url'

QrScanner.WORKER_PATH = QrScannerWorkerPath

// autoStart: Kamera startet sofort, ohne Start/Stopp-Buttons
const props = defineProps<{ autoStart?: boolean }>()
const emit = defineEmits<{ decode: [string]; error: [string] }>()

const videoRef = ref<HTMLVideoElement | null>(null)
const error = ref('')
const scanning = ref(false)
let scanner: QrScanner | null = null

async function start() {
  error.value = ''
  if (!videoRef.value) return

  scanner = new QrScanner(
    videoRef.value,
    (result) => emit('decode', result.data),
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
    <video ref="videoRef" class="qr-camera__preview"></video>
    <template v-if="!autoStart || error">
      <button class="btn btn--ghost" v-if="!scanning" @click="start">Kamera starten</button>
      <button class="btn btn--ghost" v-else @click="stop">Kamera stoppen</button>
    </template>
    <p v-if="error" class="step__error">{{ error }}</p>
  </div>
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
</style>

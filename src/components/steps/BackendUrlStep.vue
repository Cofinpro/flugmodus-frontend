<script setup lang="ts">
import { ref } from 'vue'
import { backendUrl, isHttpUrl, setBackendUrl } from '../../services/backend'
import QrCameraScanner from '../QrCameraScanner.vue'

const emit = defineEmits<{ next: [] }>()

const manualInput = ref(backendUrl.value)
const error = ref('')
// Auf dem Handy erscheint das URL-Feld nur, wenn die Kamera nicht startet
const cameraFailed = ref(false)

function saveManual() {
  if (isHttpUrl(manualInput.value)) {
    setBackendUrl(manualInput.value)
    emit('next')
  } else {
    error.value = 'Bitte eine gültige http(s)-URL eingeben.'
  }
}

// Der Scanner meldet denselben Code bei jedem Frame – nur beim ersten Treffer weiter
let advanced = false

function onDecode(text: string) {
  if (advanced) return
  if (isHttpUrl(text)) {
    advanced = true
    setBackendUrl(text)
    emit('next')
  } else {
    error.value = 'Der gescannte QR-Code enthält keine gültige URL.'
  }
}
</script>

<template>
  <section class="step">
    <QrCameraScanner auto-start @decode="onDecode" @error="cameraFailed = true" />

    <div class="field-row manual-url" :class="{ 'manual-url--forced': cameraFailed }">
      <input v-model="manualInput" type="url" placeholder="https://xxxx.ngrok-free.app" @keyup.enter="saveManual" />
      <button class="btn btn--ghost" style="width: auto" @click="saveManual">Weiter</button>
    </div>

    <p v-if="error" class="step__error">{{ error }}</p>
  </section>
</template>

<style scoped>
/* Handy: nur der Scanner. Desktop (Maus vorhanden) oder Kamera kaputt: URL-Feld dazu */
.manual-url {
  display: none;
}

.manual-url--forced {
  display: flex;
}

/* Text gehört auf Papier, nicht auf den Himmel */
.manual-url {
  padding: 12px 12px 12px 18px;
  border-radius: var(--fm-radius);
  background: var(--fm-paper-sheen), var(--fm-paper);
  filter: var(--fm-shadow-ticket);
}

.manual-url input {
  font-size: 16px;
}

@media (hover: hover) and (pointer: fine) {
  .manual-url {
    display: flex;
  }
}
</style>

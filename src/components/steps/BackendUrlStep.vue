<script setup lang="ts">
import { ref } from 'vue'
import { backendUrl, isHttpUrl, setBackendUrl } from '../../services/backend'
import QrCameraScanner from '../QrCameraScanner.vue'

const emit = defineEmits<{ next: [] }>()

const manualInput = ref(backendUrl.value)
const error = ref('')

function saveManual() {
  if (isHttpUrl(manualInput.value)) {
    setBackendUrl(manualInput.value)
    error.value = ''
  } else {
    error.value = 'Bitte eine gültige http(s)-URL eingeben.'
  }
}

function onDecode(text: string) {
  if (isHttpUrl(text)) {
    setBackendUrl(text)
    manualInput.value = text
    error.value = ''
  } else {
    error.value = 'Der gescannte QR-Code enthält keine gültige URL.'
  }
}
</script>

<template>
  <section class="step card">
    <p class="step__eyebrow">Schritt 1 von 3</p>
    <h2>Bank-Server verbinden</h2>
    <p class="step__hint">Scanne den QR-Code der Bank-Adresse oder gib sie manuell ein.</p>

    <QrCameraScanner @decode="onDecode" />

    <div class="field-row">
      <input v-model="manualInput" type="url" placeholder="https://xxxx.ngrok-free.app" @keyup.enter="saveManual" />
      <button class="btn btn--ghost" style="width: auto" @click="saveManual">Übernehmen</button>
    </div>

    <p v-if="error" class="step__error">{{ error }}</p>
    <p class="step__hint">Aktuell verbunden: {{ backendUrl || 'nicht konfiguriert' }}</p>

    <button class="btn btn--primary" :disabled="!backendUrl" @click="emit('next')">Weiter</button>
  </section>
</template>

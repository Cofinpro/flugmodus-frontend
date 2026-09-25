<script setup lang="ts">
import { ref } from 'vue'
import QrCameraScanner from '../QrCameraScanner.vue'
import type { Rfp } from '../../models/Rfp'

const emit = defineEmits<{ back: [] }>()

const rfp = ref<Rfp | null>(null)
const parseError = ref('')

function onDecode(text: string) {
  try {
    rfp.value = JSON.parse(text) as Rfp
    parseError.value = ''
  } catch {
    rfp.value = null
    parseError.value = 'Kein gültiges RFP in diesem QR-Code gefunden.'
  }
}
</script>

<template>
  <section class="step card">
    <button class="btn btn--ghost btn--back" @click="emit('back')">← Zurück</button>
    <p class="step__eyebrow">Bezahlen</p>
    <h2>Zahlungsanfrage scannen</h2>
    <p class="step__hint">Scanne den QR-Code des Empfängers, um den Betrag live zu sehen.</p>

    <QrCameraScanner @decode="onDecode" />

    <p v-if="parseError" class="step__error">{{ parseError }}</p>
    <template v-if="rfp">
      <p class="step__success">Betrag: {{ rfp.amount }} €</p>
      <p class="step__hint">An Wallet {{ rfp.walletIdPaid.slice(0, 10) }}…</p>
    </template>
  </section>
</template>

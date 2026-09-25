<script setup lang="ts">
import { ref } from 'vue'
import QrCameraScanner from '../QrCameraScanner.vue'
import { applyPayment, offlineBalance } from '../../services/wallet'
import type { Rfp } from '../../models/Rfp'

const emit = defineEmits<{ back: [] }>()

const rfp = ref<Rfp | null>(null)
const parseError = ref('')
const paid = ref(false)

function onDecode(text: string) {
  try {
    rfp.value = JSON.parse(text) as Rfp
    parseError.value = ''
    paid.value = false
  } catch {
    rfp.value = null
    parseError.value = 'Kein gültiges RFP in diesem QR-Code gefunden.'
  }
}

function confirmPayment() {
  if (!rfp.value || paid.value || rfp.value.amount > offlineBalance.value) return
  applyPayment(rfp.value.amount)
  paid.value = true
}
</script>

<template>
  <section class="step card">
    <button class="btn btn--ghost btn--back" @click="emit('back')">← Zurück</button>
    <p class="step__eyebrow">Bezahlen</p>
    <h2>Zahlungsanfrage scannen</h2>
    <p class="step__hint">Offline-Guthaben: {{ offlineBalance }} €</p>

    <QrCameraScanner @decode="onDecode" />

    <p v-if="parseError" class="step__error">{{ parseError }}</p>
    <template v-if="rfp">
      <p class="step__hint">Betrag: {{ rfp.amount }} € · An Wallet {{ rfp.walletIdPaid.slice(0, 10) }}…</p>

      <p v-if="rfp.amount > offlineBalance" class="step__error">Nicht genug Offline-Guthaben.</p>
      <button v-else class="btn btn--primary" :disabled="paid" @click="confirmPayment">
        {{ paid ? 'Bezahlt' : 'Bezahlen bestätigen' }}
      </button>
      <p v-if="paid" class="step__success">Bezahlt! Neues Offline-Guthaben: {{ offlineBalance }} €</p>
    </template>
  </section>
</template>

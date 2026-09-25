<script setup lang="ts">
import { nextTick, ref } from 'vue'
import QRCode from 'qrcode'
import QrCameraScanner from '../QrCameraScanner.vue'
import { buildPaymentProof } from '../../services/spend'
import { offlineBalance, removeCoins, selectCoins, spentCoins } from '../../services/wallet'
import type { Account } from '../../models/Account'
import type { PaymentRequest } from '../../models/PaymentRequest'

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ back: [] }>()

const request = ref<PaymentRequest | null>(null)
const parseError = ref('')
const paying = ref(false)
const paid = ref(false)
const fraud = ref(false)
const canvas = ref<HTMLCanvasElement | null>(null)

function onDecode(text: string) {
  try {
    request.value = JSON.parse(text) as PaymentRequest
    parseError.value = ''
    paid.value = false
    fraud.value = false
  } catch {
    request.value = null
    parseError.value = 'Keine gültige Zahlungsanfrage in diesem QR-Code gefunden.'
  }
}

async function confirmPayment() {
  if (!request.value || paying.value || paid.value) return

  const coinsToSpend = selectCoins(request.value.amount)
  if (!coinsToSpend) {
    parseError.value = 'Nicht genug passende Münzen im Offline-Guthaben.'
    return
  }

  paying.value = true
  try {
    const proof = await buildPaymentProof(coinsToSpend, props.account.u, request.value)
    removeCoins(coinsToSpend)
    paid.value = true
    fraud.value = false

    await nextTick()
    if (canvas.value) {
      await QRCode.toCanvas(canvas.value, JSON.stringify(proof), { width: 280 })
    }
  } finally {
    paying.value = false
  }
}

// Fraud-Demo: gibt BEREITS ausgegebene Münzen noch einmal aus (echtes Doppelausgeben).
// Kryptografisch gültig – nur beim späteren Sync-Vergleich fliegt es auf, weil für die
// beiden unterschiedlichen Challenges je Paar unterschiedliche Hälften offengelegt werden
// und sich u daraus per XOR rekonstruieren lässt.
async function fraudPay() {
  if (!request.value || paying.value) return

  const coinsToReuse = selectCoins(request.value.amount, spentCoins.value)
  if (!coinsToReuse) {
    parseError.value = 'Keine passenden bereits ausgegebenen Münzen für diesen Betrag vorhanden.'
    return
  }

  paying.value = true
  try {
    const proof = await buildPaymentProof(coinsToReuse, props.account.u, request.value)
    paid.value = true
    fraud.value = true

    await nextTick()
    if (canvas.value) {
      await QRCode.toCanvas(canvas.value, JSON.stringify(proof), { width: 280 })
    }
  } finally {
    paying.value = false
  }
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
    <template v-if="request">
      <p class="step__hint">Betrag: {{ request.amount }} € · An Wallet {{ request.walletIdPaid.slice(0, 10) }}…</p>

      <button v-if="!paid" class="btn btn--primary" :disabled="paying" @click="confirmPayment">
        {{ paying ? 'Erzeuge Beweis…' : 'Bezahlen bestätigen' }}
      </button>

      <button
        v-if="spentCoins.length > 0"
        class="btn fraud-btn"
        :disabled="paying"
        @click="fraudPay"
      >
        🚨 Bereits ausgegebene Münze nochmal einsetzen (Fraud-Demo)
      </button>

      <template v-if="paid">
        <p class="step__success">
          {{ fraud ? 'Doppelt ausgegeben!' : 'Bezahlt!' }} Neues Offline-Guthaben: {{ offlineBalance }} €
        </p>
        <p v-if="fraud" class="step__hint">
          Kryptografisch gültig – der Händler sieht davon nichts. Erst beim Sync-Abgleich der Transcripts
          fliegt es auf, weil sich u aus den zwei unterschiedlich offengelegten Hälften rekonstruieren lässt.
        </p>
        <canvas ref="canvas" class="qr-canvas"></canvas>
        <p class="step__hint">Zeig diesen Code dem Händler als Zahlungsbeweis.</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.qr-canvas {
  align-self: center;
  border-radius: var(--fm-radius-small);
  overflow: hidden;
}

.fraud-btn {
  background: transparent;
  border-color: var(--fm-red);
  color: var(--fm-red);
  font-weight: 700;
}

.fraud-btn:hover:not(:disabled) {
  background: var(--fm-red);
  color: var(--fm-paper);
}
</style>

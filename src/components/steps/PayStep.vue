<script setup lang="ts">
<script setup lang="ts">
import { nextTick, ref } from 'vue'
import QRCode from 'qrcode'
import QrCameraScanner from '../QrCameraScanner.vue'
import { buildPaymentProof } from '../../services/spend'
import { offlineBalance, removeCoins, selectCoins } from '../../services/wallet'
import type { Account } from '../../models/Account'
import type { PaymentRequest } from '../../models/PaymentRequest'

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ back: [] }>()

const request = ref<PaymentRequest | null>(null)
const parseError = ref('')
const paying = ref(false)
const paid = ref(false)
const canvas = ref<HTMLCanvasElement | null>(null)

function onDecode(text: string) {
  try {
    request.value = JSON.parse(text) as PaymentRequest
    parseError.value = ''
    paid.value = false
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

      <template v-if="paid">
        <p class="step__success">Bezahlt! Neues Offline-Guthaben: {{ offlineBalance }} €</p>
        <canvas ref="canvas" class="qr-canvas"></canvas>
        <p class="step__hint">Zeig diesen Code dem Händler als Zahlungsbeweis.</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.qr-canvas {
  align-self: center;
  border-radius: var(--radius-sm);
  overflow: hidden;
}
</style>
import QRCode from 'qrcode'
import QrCameraScanner from '../QrCameraScanner.vue'
import { buildPaymentProof } from '../../services/spend'
import { offlineBalance, removeCoins, selectCoins } from '../../services/wallet'
import type { Account } from '../../models/Account'
import type { PaymentRequest } from '../../models/PaymentRequest'

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ back: [] }>()

const request = ref<PaymentRequest | null>(null)
const parseError = ref('')
const paying = ref(false)
const paid = ref(false)
const canvas = ref<HTMLCanvasElement | null>(null)

function onDecode(text: string) {
  try {
    request.value = JSON.parse(text) as PaymentRequest
    parseError.value = ''
    paid.value = false
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

    await nextTick()
    if (canvas.value) {
      await QRCode.toCanvas(canvas.value, JSON.stringify(proof), { width: 280 })
    }
    paid.value = true
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

      <template v-if="paid">
        <p class="step__success">Bezahlt! Neues Offline-Guthaben: {{ offlineBalance }} €</p>
        <canvas ref="canvas" class="qr-canvas"></canvas>
        <p class="step__hint">Zeig diesen Code dem Händler als Zahlungsbeweis.</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.qr-canvas {
  align-self: center;
  border-radius: var(--radius-sm);
  overflow: hidden;
}
</style>

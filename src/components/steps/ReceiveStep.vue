<script setup lang="ts">
<script setup lang="ts">
import { nextTick, ref } from 'vue'
import QRCode from 'qrcode'
import QrCameraScanner from '../QrCameraScanner.vue'
import { verifyPaymentProof, type PaymentProof } from '../../services/spend'
import { recordPendingReceive } from '../../services/wallet'
import { bytesToHex, randomBytes } from '../../services/crypto'
import type { Account } from '../../models/Account'
import type { PaymentRequest } from '../../models/PaymentRequest'

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ back: [] }>()

const amount = ref<number>(10)
const request = ref<PaymentRequest | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

const parseError = ref('')
const verifyError = ref('')
const accepted = ref(false)
const verifying = ref(false)

async function createRequest() {
  const created: PaymentRequest = {
    walletIdPaid: props.account.walletId,
    nonce: bytesToHex(randomBytes(16)),
    amount: amount.value,
  }
  request.value = created
  accepted.value = false
  verifyError.value = ''

  await nextTick()
  if (canvas.value) {
    await QRCode.toCanvas(canvas.value, JSON.stringify(created), { width: 280 })
  }
}

async function onDecode(text: string) {
  if (!request.value || verifying.value) return

  parseError.value = ''
  verifyError.value = ''

  let proof: PaymentProof
  try {
    proof = JSON.parse(text) as PaymentProof
  } catch {
    parseError.value = 'Kein gültiger Zahlungsbeweis in diesem QR-Code gefunden.'
    return
  }

  verifying.value = true
  try {
    const result = await verifyPaymentProof(proof, request.value, props.account.bankPublicKey, props.account.bankExponent)
    if (result.valid) {
      recordPendingReceive(request.value.walletIdPaid, request.value.nonce, result.amount)
      accepted.value = true
    } else {
      verifyError.value = result.reason ?? 'Zahlung ungültig.'
    }
  } finally {
    verifying.value = false
  }
}
</script>

<template>
  <section class="step card">
    <button class="btn btn--ghost btn--back" @click="emit('back')">← Zurück</button>
    <p class="step__eyebrow">Bezahlt werden</p>
    <h2>Zahlungsanfrage erstellen</h2>

    <div class="field-row">
      <input type="number" v-model.number="amount" min="1" />
      <span>€</span>
      <button class="btn btn--ghost" style="width: auto" @click="createRequest">Erstellen</button>
    </div>

    <template v-if="request">
      <canvas ref="canvas" class="qr-canvas"></canvas>
      <p class="step__hint">Lass den Käufer diesen Code scannen, dann scanne seinen Beweis-Code.</p>

      <QrCameraScanner @decode="onDecode" />

      <p v-if="verifying" class="step__hint">Prüfe Zahlungsbeweis…</p>
      <p v-if="parseError" class="step__error">{{ parseError }}</p>
      <p v-if="verifyError" class="step__error">{{ verifyError }}</p>
      <p v-if="accepted" class="step__success">
        Zahlung über {{ request.amount }} € angenommen und für den Sync vorgemerkt.
      </p>
    </template>
  </section>
</template>

<style scoped>
.qr-canvas {
  align-self: center;
  margin: 12px 0;
}
</style>
import QRCode from 'qrcode'
import QrCameraScanner from '../QrCameraScanner.vue'
import { verifyPaymentProof, type PaymentProof } from '../../services/spend'
import { recordPendingReceive } from '../../services/wallet'
import { bytesToHex, randomBytes } from '../../services/crypto'
import type { Account } from '../../models/Account'
import type { PaymentRequest } from '../../models/PaymentRequest'

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ back: [] }>()

const amount = ref<number>(10)
const request = ref<PaymentRequest | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

const parseError = ref('')
const verifyError = ref('')
const accepted = ref(false)
const verifying = ref(false)

async function createRequest() {
  const created: PaymentRequest = {
    walletIdPaid: props.account.walletId,
    nonce: bytesToHex(randomBytes(16)),
    amount: amount.value,
  }
  request.value = created
  accepted.value = false
  verifyError.value = ''

  await nextTick()
  if (canvas.value) {
    await QRCode.toCanvas(canvas.value, JSON.stringify(created), { width: 280 })
  }
}

async function onDecode(text: string) {
  if (!request.value || verifying.value) return

  parseError.value = ''
  verifyError.value = ''

  let proof: PaymentProof
  try {
    proof = JSON.parse(text) as PaymentProof
  } catch {
    parseError.value = 'Kein gültiger Zahlungsbeweis in diesem QR-Code gefunden.'
    return
  }

  verifying.value = true
  try {
    const result = await verifyPaymentProof(proof, request.value, props.account.bankPublicKey, props.account.bankExponent)
    if (result.valid) {
      recordPendingReceive(request.value.walletIdPaid, request.value.nonce, result.amount)
      accepted.value = true
    } else {
      verifyError.value = result.reason ?? 'Zahlung ungültig.'
    }
  } finally {
    verifying.value = false
  }
}
</script>

<template>
  <section class="step card">
    <button class="btn btn--ghost btn--back" @click="emit('back')">← Zurück</button>
    <p class="step__eyebrow">Bezahlt werden</p>
    <h2>Zahlungsanfrage erstellen</h2>

    <div class="field-row">
      <input type="number" v-model.number="amount" min="1" />
      <span>€</span>
      <button class="btn btn--ghost" style="width: auto" @click="createRequest">Erstellen</button>
    </div>

    <template v-if="request">
      <canvas ref="canvas" class="qr-canvas"></canvas>
      <p class="step__hint">Lass den Käufer diesen Code scannen, dann scanne seinen Beweis-Code.</p>

      <QrCameraScanner @decode="onDecode" />

      <p v-if="verifying" class="step__hint">Prüfe Zahlungsbeweis…</p>
      <p v-if="parseError" class="step__error">{{ parseError }}</p>
      <p v-if="verifyError" class="step__error">{{ verifyError }}</p>
      <p v-if="accepted" class="step__success">
        Zahlung über {{ request.amount }} € angenommen und für den Sync vorgemerkt.
      </p>
    </template>
  </section>
</template>

<style scoped>
.qr-canvas {
  align-self: center;
  margin: 12px 0;
}
</style>

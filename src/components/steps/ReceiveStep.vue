<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import QRCode from 'qrcode'
import QrCameraScanner from '../QrCameraScanner.vue'
import { decodeProof, verifyPaymentProof, type PaymentProof } from '../../services/spend'
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
// Kamera erst auf Knopfdruck; solange sie läuft, wird der eigene Code ausgeblendet
const scanning = ref(false)
const successDialog = ref<HTMLDialogElement | null>(null)

async function createRequest() {
  const created: PaymentRequest = {
    walletIdPaid: props.account.walletId,
    merchantName: props.account.username,
    nonce: bytesToHex(randomBytes(16)),
    amount: amount.value,
  }
  request.value = created
  accepted.value = false
  verifyError.value = ''
  parseError.value = ''
  scanning.value = false

  await nextTick()
  if (canvas.value) {
    await QRCode.toCanvas(canvas.value, JSON.stringify(created), { width: 280 })
  }
}

// Die Canvas wird beim Scannen ausgebaut – geht die Kamera aus, den eigenen Code neu zeichnen
watch(scanning, async (isScanning) => {
  if (isScanning || !request.value) return
  await nextTick()
  if (canvas.value) await QRCode.toCanvas(canvas.value, JSON.stringify(request.value), { width: 280 })
})

function showRequestCode() {
  scanning.value = false
  parseError.value = ''
}

function startScan() {
  parseError.value = ''
  verifyError.value = ''
  scanning.value = true
}

async function onDecode(text: string) {
  if (!request.value || verifying.value || !scanning.value) return

  parseError.value = ''
  verifyError.value = ''

  let proof: PaymentProof
  try {
    proof = decodeProof(text)
  } catch {
    // Kamera weiterlaufen lassen – vielleicht war nur der falsche Code im Bild
    parseError.value = 'Kein gültiger Zahlungsbeweis in diesem QR-Code gefunden.'
    return
  }

  scanning.value = false // Code erkannt: Kamera aus
  verifying.value = true
  try {
    const result = await verifyPaymentProof(proof, request.value, props.account.bankPublicKey, props.account.bankExponent)
    if (result.valid) {
      recordPendingReceive(request.value.walletIdPaid, request.value.nonce, result.amount)
      accepted.value = true
      await nextTick()
      successDialog.value?.showModal()
    } else {
      verifyError.value = result.reason ?? 'Zahlung ungültig.'
    }
  } finally {
    verifying.value = false
  }
}

function goHome() {
  successDialog.value?.close()
  emit('back')
}
</script>

<template>
  <section class="step card">
    <button class="btn btn--ghost btn--back" @click="emit('back')">← Zurück</button>
    <p class="step__eyebrow">Bezahlt werden</p>
    <h2>Zahlungsanfrage erstellen</h2>

    <div v-if="!scanning" class="field-row">
      <input type="number" v-model.number="amount" min="1" />
      <span>€</span>
      <button class="btn btn--ghost" style="width: auto" @click="createRequest">Erstellen</button>
    </div>

    <template v-if="request">
      <template v-if="!scanning">
        <canvas ref="canvas" class="qr-canvas"></canvas>
        <p class="step__hint">Lass den Käufer diesen Code scannen. Danach scannst du seinen Zahlungs-Code.</p>
        <button v-if="!verifying && !accepted" class="btn btn--primary" @click="startScan">
          {{ verifyError ? 'Nochmal scannen' : 'Zahlung scannen' }}
        </button>
      </template>

      <template v-else>
        <QrCameraScanner auto-start @decode="onDecode" />
        <button class="btn btn--ghost" @click="showRequestCode">Zurück zum Code</button>
      </template>

      <p v-if="verifying" class="step__hint">Prüfe Zahlungsbeweis…</p>
      <p v-if="parseError" class="step__error">{{ parseError }}</p>
      <p v-if="verifyError" class="step__error">{{ verifyError }}</p>
    </template>

    <dialog ref="successDialog" class="modal" @cancel.prevent="goHome">
      <template v-if="request">
        <p class="step__eyebrow">Erhalten</p>
        <p class="fm-amount modal__amount">+{{ request.amount }}<small>€</small></p>
        <h3>Zahlung angenommen</h3>
        <p class="step__hint">Wird beim nächsten Sync mit der Bank gutgeschrieben.</p>
        <div class="modal__actions">
          <button class="btn btn--primary" @click="goHome">Fertig</button>
        </div>
      </template>
    </dialog>
  </section>
</template>

<style scoped>
.qr-canvas {
  align-self: center;
  margin: 12px 0;
}

.modal__amount {
  margin: 10px 0 14px;
}

/* Handy: QR-Code passt sich der Bildschirmhöhe an (qrcode setzt die Größe inline, daher !important) */
@media (hover: none) and (pointer: coarse) {
  .qr-canvas {
    width: min(280px, 38dvh) !important;
    height: auto !important;
  }
}
</style>

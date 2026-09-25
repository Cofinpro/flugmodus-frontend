<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import QRCode from 'qrcode'
import QrCameraScanner from '../QrCameraScanner.vue'
import { buildPaymentProof, encodeProof, type PaymentProof } from '../../services/spend'
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
const confirmDialog = ref<HTMLDialogElement | null>(null)
const homeDialog = ref<HTMLDialogElement | null>(null)

const merchant = computed(() => request.value?.merchantName || `Wallet ${request.value?.walletIdPaid.slice(0, 10)}…`)
const enoughBalance = computed(() => !!request.value && request.value.amount <= offlineBalance.value)

// Der Scanner meldet den Händler-Code bei jedem Kamerabild neu. Ist eine Anfrage erkannt,
// wird nichts mehr überschrieben – sonst verschwände der Zahlungsbeweis nach dem Bezahlen,
// obwohl die Münzen schon ausgegeben sind.
async function onDecode(text: string) {
  if (request.value) return
  try {
    const parsed = JSON.parse(text) as PaymentRequest
    if (typeof parsed.amount !== 'number' || typeof parsed.walletIdPaid !== 'string') throw new Error()
    request.value = parsed
    parseError.value = ''
    fraud.value = false
  } catch {
    parseError.value = 'Keine gültige Zahlungsanfrage in diesem QR-Code gefunden.'
    return
  }
  await nextTick()
  confirmDialog.value?.showModal()
}

// Abbrechen im Modal: Anfrage verwerfen, Kamera läuft wieder an
function cancelPayment() {
  confirmDialog.value?.close()
  request.value = null
}

// Blendet die Vollbild-Ansicht ein und zeichnet den Beweis. false, wenn kein QR-Code entstand.
async function showProof(proof: PaymentProof): Promise<boolean> {
  paid.value = true
  await nextTick()
  try {
    if (!canvas.value) throw new Error('QR-Fläche fehlt')
    // hohe Auflösung, die Größe am Bildschirm regelt CSS; Stufe L für möglichst grobe Module
    await QRCode.toCanvas(canvas.value, encodeProof(proof), { errorCorrectionLevel: 'L', margin: 2, width: 1024 })
    return true
  } catch {
    paid.value = false
    parseError.value = 'Der Zahlungs-QR-Code konnte nicht erzeugt werden. Deine Münzen bleiben in der Wallet.'
    request.value = null
    return false
  }
}

async function confirmPayment() {
  if (!request.value || paying.value || paid.value || !enoughBalance.value) return

  const coinsToSpend = selectCoins(request.value.amount)
  if (!coinsToSpend) {
    parseError.value = 'Nicht genug passende Münzen im Offline-Guthaben.'
    cancelPayment()
    return
  }

  confirmDialog.value?.close()
  paying.value = true
  try {
    const proof = await buildPaymentProof(coinsToSpend, props.account.u, request.value)
    fraud.value = false
    // Münzen erst ausgeben, wenn der Beweis wirklich als QR-Code dasteht – sonst wäre das Geld weg
    if (!(await showProof(proof))) return
    removeCoins(coinsToSpend) // jetzt ist das Geld ausgegeben
    keepScreenOn()
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
    cancelPayment()
    return
  }

  confirmDialog.value?.close()
  paying.value = true
  try {
    const proof = await buildPaymentProof(coinsToReuse, props.account.u, request.value)
    fraud.value = true
    if (await showProof(proof)) keepScreenOn()
  } finally {
    paying.value = false
  }
}

// Helligkeit darf eine Web-App nicht setzen – aber wach halten, damit der Bildschirm nicht dunkler wird
let wakeLock: WakeLockSentinel | null = null
async function keepScreenOn() {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null
  } catch {
    wakeLock = null // z. B. Energiesparmodus – dann eben ohne
  }
}
function onVisibility() {
  if (paid.value && document.visibilityState === 'visible') keepScreenOn()
}
document.addEventListener('visibilitychange', onVisibility)
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  wakeLock?.release()
})

function askHome() {
  homeDialog.value?.showModal()
}

function goHome() {
  homeDialog.value?.close()
  emit('back')
}
</script>

<template>
  <section v-if="!paid" class="step card">
    <button class="btn btn--ghost btn--back" @click="emit('back')">← Zurück</button>
    <p class="step__eyebrow">Bezahlen</p>
    <h2>Händler-Code scannen</h2>
    <p class="step__hint">Offline-Guthaben: {{ offlineBalance }} €</p>

    <!-- Kamera nur, solange noch keine Anfrage erkannt ist (v-if schaltet sie beim Ausblenden ab) -->
    <QrCameraScanner v-if="!request" auto-start @decode="onDecode" />
    <p v-else-if="paying" class="step__hint">Erzeuge Zahlungsbeweis …</p>

    <p v-if="parseError" class="step__error">{{ parseError }}</p>

    <dialog ref="confirmDialog" class="modal" @cancel.prevent="cancelPayment">
      <template v-if="request">
        <p class="step__eyebrow">Zahlung an {{ merchant }}</p>
        <p class="fm-amount modal__amount">{{ request.amount }}<small>€</small></p>
        <h3>Willst du das zahlen?</h3>
        <p v-if="enoughBalance" class="step__hint">Danach hast du noch {{ offlineBalance - request.amount }} € offline.</p>
        <p v-else class="step__error">Nicht genug Offline-Guthaben ({{ offlineBalance }} €).</p>
        <div class="modal__actions">
          <button class="btn modal__yes" :disabled="!enoughBalance" @click="confirmPayment">Ja, zahlen</button>
          <button class="btn modal__cancel" @click="cancelPayment">Abbrechen</button>
          <button v-if="spentCoins.length > 0" class="btn fraud-btn" :disabled="paying" @click="fraudPay">
            🚨 Bereits ausgegebene Münze nochmal einsetzen (Fraud-Demo)
          </button>
        </div>
      </template>
    </dialog>
  </section>

  <!-- Nach dem Bezahlen nur noch der eigene Code: groß, mittig, auf Weiß -->
  <div v-else class="proof-screen">
    <p class="proof-screen__label">
      {{ fraud ? 'Doppelt ausgegeben · ' : '' }}{{ request?.amount }} € an {{ merchant }}
    </p>
    <canvas ref="canvas" class="proof-screen__qr" role="img" aria-label="Zahlungs-QR-Code"></canvas>
    <p class="proof-screen__hint">Lass den Händler diesen Code scannen.</p>
    <p v-if="fraud" class="proof-screen__fraud">
      Kryptografisch gültig – der Händler sieht davon nichts. Erst beim Sync-Abgleich der Transcripts
      fliegt es auf, weil sich u aus den zwei unterschiedlich offengelegten Hälften rekonstruieren lässt.
    </p>
    <button class="proof-screen__home" @click="askHome">Fertig</button>

    <dialog ref="homeDialog" class="modal" @cancel.prevent="homeDialog?.close()">
      <p class="step__eyebrow">Zur Übersicht</p>
      <h3>Hat der Händler gescannt?</h3>
      <p class="step__hint">
        Danach kannst du diesen Code nicht mehr anzeigen.
        {{ fraud ? 'Die Münzen waren schon ausgegeben – das fliegt beim Sync auf.' : `Die ${request?.amount} € sind bereits abgebucht.` }}
      </p>
      <div class="modal__actions">
        <button class="btn" @click="goHome">Ja, zur Übersicht</button>
        <button class="btn modal__cancel" @click="homeDialog?.close()">Code weiter zeigen</button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.modal__amount {
  margin: 10px 0 14px;
}

/* Vollbild auf Weiß: maximaler Kontrast und so hell, wie der Bildschirm gerade eingestellt ist */
.proof-screen {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: max(16px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background: #fff;
  color: var(--fm-ink);
}

.proof-screen__label {
  font-family: var(--fm-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.proof-screen__qr {
  width: min(94vw, calc(100dvh - 190px)) !important;
  height: auto !important;
  aspect-ratio: 1 / 1;
  image-rendering: pixelated;
}

.proof-screen__hint {
  font-size: 15px;
  color: var(--fm-ink-soft);
}

.proof-screen__fraud {
  max-width: 420px;
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
  color: var(--fm-red);
}

/* dezent: nur ein Textlink, damit niemand aus Versehen den Code wegtippt */
.proof-screen__home {
  margin-top: 6px;
  padding: 8px 14px;
  border: 0;
  background: none;
  color: var(--fm-ink-soft);
  font: 600 12px/1 var(--fm-mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
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

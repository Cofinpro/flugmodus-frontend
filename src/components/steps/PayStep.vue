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
          <button
            v-if="spentCoins.length > 0"
            class="btn fraud-btn"
            :disabled="paying"
            title="muehuehue"
            @click="fraudPay"
          >
            <!-- Hacker-Katze: Kapuze, Sonnenbrille, grünes Terminal-Glimmen. muehuehue. -->
            <svg class="hacker-cat" viewBox="0 0 64 64" aria-hidden="true">
              <ellipse class="hacker-cat__glow" cx="32" cy="58" rx="22" ry="5" />
              <path class="hacker-cat__hood" d="M6 62 C6 34 13 12 32 8 C51 12 58 34 58 62 Z" />
              <path class="hacker-cat__fur" d="M17 33 L19 15 L28 25 Z M47 33 L45 15 L36 25 Z" />
              <path class="hacker-cat__ear" d="M20 28 L21 19 L26 25 Z M44 28 L43 19 L38 25 Z" />
              <ellipse class="hacker-cat__fur" cx="32" cy="38" rx="16" ry="14" />
              <g class="hacker-cat__shades">
                <rect x="17" y="31" width="13" height="8" rx="3" />
                <rect x="34" y="31" width="13" height="8" rx="3" />
                <path d="M30 34 H34" />
              </g>
              <path class="hacker-cat__code" d="M19 35 H24 M20 37 H27 M36 35 H41 M37 37 H44" />
              <path class="hacker-cat__glint" d="M21 32.5 L24 32.5 M38 32.5 L41 32.5" />
              <path class="hacker-cat__nose" d="M30 43 H34 L32 45.5 Z" />
              <path class="hacker-cat__grin" d="M27 47.5 Q32 51 38 46.5" />
              <path class="hacker-cat__whisker" d="M16 44 L6 42 M16 47 L7 48 M48 44 L58 42 M48 47 L57 48" />
            </svg>
            <span class="fraud-btn__text">
              <strong>Muehuehue</strong>
              <small>Bereits ausgegebene Münze nochmal einsetzen · Fraud-Demo</small>
            </span>
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

.fraud-btn {
  justify-content: flex-start;
  gap: 14px;
  padding-block: 12px;
  text-align: left;
}

.fraud-btn__text {
  display: grid;
  gap: 4px;
}

.fraud-btn__text strong {
  font-size: 17px;
  letter-spacing: -0.01em;
}

.fraud-btn__text small {
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.3;
  opacity: 0.85;
}

/* Hacker-Katze */
.hacker-cat {
  flex: none;
  width: 46px;
  height: 46px;
  overflow: visible;
}
.hacker-cat__glow { fill: #3ee05b; opacity: 0.25; }
.hacker-cat__hood { fill: var(--fm-ink); }
.hacker-cat__fur { fill: #8f95a3; }
.hacker-cat__ear { fill: #f2a7b8; }
.hacker-cat__shades rect { fill: #050608; }
.hacker-cat__shades path { fill: none; stroke: #050608; stroke-width: 2; }
.hacker-cat__code { fill: none; stroke: #3ee05b; stroke-width: 1; stroke-linecap: round; opacity: 0.85; }
.hacker-cat__glint { fill: none; stroke: #fff; stroke-width: 1.2; stroke-linecap: round; opacity: 0; }
.hacker-cat__nose { fill: #f2a7b8; }
.hacker-cat__grin { fill: none; stroke: var(--fm-ink); stroke-width: 1.8; stroke-linecap: round; }
.hacker-cat__whisker { fill: none; stroke: var(--fm-ink); stroke-width: 1; stroke-linecap: round; opacity: 0.6; }

/* muehuehue: beim Drüberfahren blitzt die Brille, beim Drücken kichert die Katze */
.fraud-btn:hover .hacker-cat__glint { animation: hacker-glint 1.4s ease-in-out infinite; }
.fraud-btn:active .hacker-cat { animation: hacker-giggle 0.12s steps(2) 4; }
.hacker-cat__code { animation: hacker-code 1.1s steps(3) infinite; }
@keyframes hacker-glint {
  0%, 60%, 100% { opacity: 0; }
  70%, 80% { opacity: 1; }
}
@keyframes hacker-giggle {
  from { transform: rotate(-6deg) translateY(-1px); }
  to { transform: rotate(6deg) translateY(1px); }
}
@keyframes hacker-code {
  33% { stroke-dasharray: 2 1; }
  66% { stroke-dasharray: 4 2; }
}
@media (prefers-reduced-motion: reduce) {
  .hacker-cat,
  .hacker-cat__glint,
  .hacker-cat__code { animation: none !important; }
}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Account } from '../../models/Account'
import { syncAccount } from '../../services/account'
import {
  clearPendingTransactions,
  offlineBalance,
  pendingBalance,
  pendingTransactions,
} from '../../services/wallet'

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ select: ['topup' | 'receive' | 'pay']; synced: [number] }>()

const syncing = ref(false)
const syncError = ref('')
const syncMessage = ref('')

// Profilbild groß: Tippen öffnet, Schließen per ✕, Knopf, Tippen daneben oder Esc
const photoDialog = ref<HTMLDialogElement | null>(null)
function openPhoto() {
  photoDialog.value?.showModal()
}
function closePhoto() {
  photoDialog.value?.close()
}
function onPhotoDialogClick(event: MouseEvent) {
  if (event.target === photoDialog.value) closePhoto() // Tipp auf den dunklen Hintergrund
}

// Wallet-ID in Vierergruppen, gut vorlesbar: a1b2 c3d4 e5f6 a7b8
const walletIdGroups = computed(() => props.account.walletId.match(/.{1,4}/g) ?? [])

// Strichcode aus den Bits der Wallet-ID: 1 = breiter Strich, 0 = schmaler, dazwischen immer eine Lücke
const barcode = computed(() => {
  const bars: { x: number; w: number }[] = []
  let x = 0
  for (const digit of props.account.walletId) {
    const nibble = parseInt(digit, 16)
    for (let bit = 3; bit >= 0; bit--) {
      const w = (nibble >> bit) & 1 ? 2 : 1
      bars.push({ x, w })
      x += w + 1
    }
  }
  return { bars, width: Math.max(1, x - 1) }
})

// Netzstatus des Handys: im Flugmodus sind Konto, Aufladen und Sync nicht erreichbar,
// Senden und Empfangen im Wallet gehen trotzdem. Ob die Bank selbst antwortet, prüfen wir nicht.
const online = ref(navigator.onLine)
function updateOnline() {
  online.value = navigator.onLine
}
onMounted(() => {
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnline)
  window.removeEventListener('offline', updateOnline)
})

const copied = ref(false)
async function copyWalletId() {
  try {
    await navigator.clipboard.writeText(props.account.walletId)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    // ohne Clipboard-Zugriff (z. B. http) einfach nichts tun – die ID steht ja da
  }
}

async function sync() {
  const received = pendingTransactions.value.flatMap((tx) => tx.coins)
  if (received.length === 0) return

  syncing.value = true
  syncError.value = ''
  syncMessage.value = ''
  try {
    const result = await syncAccount(props.account.walletId, received)
    // Jede Münze ist jetzt erledigt – gutgeschrieben oder endgültig abgelehnt. Nichts wird doppelt eingereicht.
    clearPendingTransactions()
    emit('synced', result.balance)
    if (result.credited > 0 || result.rejected.length === 0) syncMessage.value = `${result.credited} € gutgeschrieben.`
    if (result.rejected.length > 0) {
      const reasons = [...new Set(result.rejected.map((r) => r.reason))].join(', ')
      const n = result.rejected.length
      syncError.value = `${n} ${n === 1 ? 'Münze' : 'Münzen'} abgelehnt: ${reasons}.`
    }
  } catch (e) {
    syncError.value = (e as Error).message
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <section class="step menu">
    <!-- ONLINE: das Konto liegt bei der Bank – nur mit Netz erreichbar -->
    <article class="zone-online" :class="{ 'zone-online--away': !online }" aria-label="Bankkonto (online)">
      <header class="zone-head">
        <span class="zone-tag zone-tag--online">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 18h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.5 4.5 0 0 0 7 18Z" />
          </svg>
          Online · Bankkonto
        </span>
        <span class="zone-where">{{ online ? 'bei der Bank' : 'nicht erreichbar' }}</span>
      </header>
      <div class="zone-online__body">
        <button
          v-if="account.photo"
          type="button"
          class="holder__photo-btn"
          aria-label="Profilbild groß anzeigen"
          @click="openPhoto"
        >
          <img :src="account.photo" class="holder__photo" alt="" />
        </button>
        <div class="holder">
          <p class="zone-label">Kontoinhaber</p>
          <p class="holder__name">{{ account.username }}</p>
        </div>
        <div class="zone-online__balance">
          <p class="zone-label">Kontostand</p>
          <p class="balance balance--online">{{ account.balance }} <small>€</small></p>
        </div>
      </div>
    </article>

    <!-- Brücke: nur hier wechselt Geld zwischen Konto und Wallet, dafür braucht es Netz -->
    <div class="bridge" :class="{ 'bridge--offline': !online }" aria-label="Zwischen Konto und Wallet">
      <button class="bridge__btn bridge__btn--down" :disabled="!online" @click="emit('select', 'topup')">
        <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6" /></svg>
        <span class="bridge__text">
          <span>Aufladen</span>
          <small>Konto → Wallet</small>
        </span>
      </button>
      <span
        class="bridge__net"
        role="status"
        :title="online ? 'Internet verbunden' : 'Kein Internet – Aufladen und Sync gehen erst wieder mit Netz'"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 9a14 14 0 0 1 19 0M5.8 12.4a9 9 0 0 1 12.4 0M9.1 15.8a4.2 4.2 0 0 1 5.8 0" />
          <circle cx="12" cy="19" r="1.2" />
          <path v-if="!online" class="bridge__net-cross" d="M4 4l16 16" />
        </svg>
        <span class="bridge__net-label">
          <span class="bridge__net-dot" aria-hidden="true"></span><span class="bridge__net-word">{{ online ? 'Online' : 'Offline' }}</span>
        </span>
      </span>
      <button class="bridge__btn bridge__btn--up" :disabled="!online || syncing || pendingBalance === 0" @click="sync">
        <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5M6 11l6-6 6 6" /></svg>
        <span class="bridge__text">
          <span>{{ syncing ? 'Sync …' : 'Sync' }}</span>
          <small>Wallet → Konto</small>
        </span>
        <span v-if="pendingBalance > 0 && !syncing" class="sync-badge">{{ pendingBalance }} €</span>
      </button>
    </div>
    <p v-if="!online" class="bridge__offline-hint">
      Flugmodus: Konto gerade nicht erreichbar. Senden und Empfangen gehen trotzdem.
    </p>
    <p v-if="syncMessage" class="step__success">{{ syncMessage }}</p>
    <p v-if="syncError" class="step__error">{{ syncError }}</p>

    <!-- OFFLINE: das Wallet ist dieses Handy – Münzen gehen ohne Netz von Hand zu Hand -->
    <article class="fm-ticket wallet" aria-label="Wallet (offline)">
      <div class="fm-ticket-main wallet__main">
        <header class="zone-head">
          <span class="zone-tag zone-tag--offline">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
            Offline · Wallet
          </span>
          <span class="zone-where zone-where--ink">auf diesem Handy</span>
        </header>

        <p class="zone-label">Münzen im Wallet</p>
        <p class="balance">{{ offlineBalance }} <small>€</small></p>
        <p v-if="pendingBalance > 0" class="wallet__pending">
          + {{ pendingBalance }} € empfangen, wartet auf Sync
        </p>

        <div class="menu-grid">
          <button class="menu-tile" @click="emit('select', 'pay')">
            <span class="menu-tile__icon">
              <!-- Papierflieger: Geld fliegt los -->
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 3 3 10.5l7 2.8L13.5 21 21 3Z" />
                <path d="m10 13.3 5.5-5.5" />
              </svg>
            </span>
            <span class="menu-tile__label">Senden</span>
            <span class="menu-tile__hint">Händler-Code scannen</span>
          </button>
          <button class="menu-tile" @click="emit('select', 'receive')">
            <span class="menu-tile__icon">
              <!-- Pfeil in die Ablage: Geld kommt an -->
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v11M7.5 9.5 12 14l4.5-4.5" />
                <path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" />
              </svg>
            </span>
            <span class="menu-tile__label">Empfangen</span>
            <span class="menu-tile__hint">Betrag anfordern</span>
          </button>
        </div>
      </div>

      <!-- Abriss wie beim Boarding Pass: Wallet-ID mit Strichcode aus ihren Bits -->
      <button
        type="button"
        class="fm-ticket-stub wallet__stub"
        :aria-label="`Wallet-ID ${account.walletId} kopieren`"
        @click="copyWalletId"
      >
        <span class="wallet__id-row">
          <span class="zone-label">Wallet-ID</span>
          <span class="wallet__copy">{{ copied ? 'kopiert ✓' : 'tippen zum Kopieren' }}</span>
        </span>
        <span class="wallet__id">
          <span v-for="(group, i) in walletIdGroups" :key="i">{{ group }}</span>
        </span>
        <svg class="wallet__barcode" :viewBox="`0 0 ${barcode.width} 10`" preserveAspectRatio="none" aria-hidden="true">
          <rect v-for="(bar, i) in barcode.bars" :key="i" :x="bar.x" y="0" :width="bar.w" height="10" />
        </svg>
      </button>
    </article>

    <dialog
      v-if="account.photo"
      ref="photoDialog"
      class="photo-dialog"
      aria-label="Profilbild"
      @click="onPhotoDialogClick"
      @cancel.prevent="closePhoto"
    >
      <div class="photo-dialog__card">
        <button type="button" class="photo-dialog__close" aria-label="Schließen" @click="closePhoto">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <img :src="account.photo" class="photo-dialog__image" :alt="`Profilbild von ${account.username}`" />
        <p class="step__eyebrow">{{ account.username }}</p>
        <button type="button" class="btn" @click="closePhoto">Schließen</button>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.menu {
  gap: 0;
}

/* ---------- Gemeinsam: Kopfzeile einer Zone ---------- */
.zone-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.zone-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 11px 6px 9px;
  border-radius: 999px;
  font: 700 10.5px/1 var(--fm-mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  white-space: nowrap;
}

.zone-tag svg {
  width: 15px;
  height: 15px;
}

.zone-tag--online {
  border: 1px solid rgb(255 255 255 / 0.28);
  color: var(--fm-paper);
}

.zone-tag--online svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linejoin: round;
}

.zone-tag--offline {
  background: var(--fm-ink);
  color: var(--fm-amber);
}

.zone-tag--offline svg {
  transform: rotate(45deg);
}

.zone-where {
  font: 500 12px/1.2 var(--fm-mono);
  color: rgb(243 238 228 / 0.6);
  text-align: right;
}

.zone-where--ink {
  color: var(--fm-ink-soft);
}

/* Label wie ein Ticketfeld */
.zone-label {
  font: 600 10px/1 var(--fm-mono);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fm-ink-soft);
}

.balance {
  margin-top: 8px;
  font-size: 56px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.045em;
}

.balance small {
  font-size: 0.45em;
  font-weight: 500;
  letter-spacing: 0;
}

/* ---------- Online: gläsern im Himmel, nicht in der Hand ---------- */
.zone-online {
  display: grid;
  gap: 18px;
  padding: 18px 20px 20px;
  border: 1px solid rgb(255 255 255 / 0.14);
  border-radius: var(--fm-radius-ticket);
  background: linear-gradient(160deg, rgb(59 91 255 / 0.16), rgb(255 255 255 / 0.04) 60%);
  color: var(--fm-paper);
  backdrop-filter: blur(6px);
}

.zone-online .zone-label {
  color: rgb(243 238 228 / 0.55);
}

.zone-online__body {
  display: flex;
  align-items: center;
  gap: 14px;
}

.holder {
  flex: 1;
  min-width: 0;
}

.holder__name {
  margin-top: 6px;
  overflow: hidden;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.015em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zone-online__balance {
  text-align: right;
}

.balance--online {
  margin-top: 6px;
  font-size: 34px;
}

.holder__photo-btn {
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: zoom-in;
  transition: transform 0.15s ease;
}

.holder__photo-btn:active {
  transform: scale(0.94);
}

.holder__photo-btn:focus-visible {
  outline: 3px solid var(--fm-amber);
  outline-offset: 3px;
}

.holder__photo {
  display: block;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 2px var(--fm-sky), 0 0 0 3.5px rgb(243 238 228 / 0.7);
}

/* ---------- Brücke: gestrichelte Leitung von oben nach unten ---------- */
.bridge {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 16px 0;
}

.bridge::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 50%;
  border-left: 2px dashed rgb(255 181 71 / 0.45);
  transform: translateX(-1px);
}

.bridge__net {
  position: relative; /* über der Leitung */
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 6px 4px;
  border-radius: 10px;
  background: var(--fm-sky);
  color: rgb(243 238 228 / 0.6);
  font: 600 9.5px/1 var(--fm-mono);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.bridge__net svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}

.bridge__net-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  letter-spacing: 0.06em; /* „Offline“ passt so auch aufs schmale Handy */
}

.bridge__net-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fm-green);
  box-shadow: 0 0 6px var(--fm-green);
}

.bridge__net-cross {
  stroke: var(--fm-red);
  stroke-width: 2.4;
}

.bridge--offline .bridge__net {
  color: #ff8a73;
}

.bridge--offline .bridge__net-dot {
  background: var(--fm-red);
  box-shadow: none;
}

/* ohne Netz: Leitung gekappt – nur noch blasse Striche */
.bridge--offline::before {
  border-left-color: rgb(243 238 228 / 0.14);
}

.bridge__offline-hint {
  margin-bottom: 14px;
  font: 500 12.5px/1.4 var(--fm-mono);
  color: rgb(243 238 228 / 0.7);
  text-align: center;
}

.zone-online {
  transition: opacity 0.3s ease, filter 0.3s ease;
}

.zone-online--away {
  opacity: 0.5;
  filter: grayscale(1);
}

.bridge__net circle {
  fill: currentColor;
  stroke: none;
}

.bridge__btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 11px 14px;
  border-radius: var(--fm-radius);
  font: 700 15px/1.1 var(--fm-sans);
  text-align: left;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.2s ease, color 0.2s ease;
}

.bridge__btn:active:not(:disabled) {
  transform: translateY(1px);
}

.bridge__btn:focus-visible {
  outline: 3px solid var(--fm-amber);
  outline-offset: 3px;
}

.bridge__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.bridge__btn--down {
  border: 0;
  background: var(--fm-amber);
  color: var(--fm-ink);
}

.bridge__btn--down:hover:not(:disabled) {
  background: var(--fm-amber-deep);
}

.bridge__btn--up {
  justify-self: stretch;
  border: var(--fm-line) solid rgb(243 238 228 / 0.55);
  background: rgb(7 9 17 / 0.6);
  color: var(--fm-paper);
}

.bridge__btn--up:hover:not(:disabled) {
  border-color: var(--fm-amber);
  color: var(--fm-amber);
}

.bridge__text {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.bridge__text small {
  font: 500 10.5px/1 var(--fm-mono);
  letter-spacing: 0.02em;
  opacity: 0.75;
  white-space: nowrap;
}

.sync-badge {
  margin-left: auto;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--fm-amber);
  color: var(--fm-ink);
  font: 700 12px/1 var(--fm-sans);
}

.action-icon {
  flex: none;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.step__success,
.step__error {
  margin-bottom: 14px;
}

/* Schmales Handy: Status nur als Symbol + Punkt, Knöpfe etwas enger */
@media (max-width: 400px) {
  .bridge {
    gap: 8px;
  }

  .bridge__btn {
    gap: 8px;
    padding: 11px 10px;
  }

  .bridge__net-word {
    display: none;
  }

  .zone-where {
    font-size: 11px;
  }
}

/* ---------- Offline: das Ticket in der Hand ---------- */
.wallet {
  width: 100%;
}

.wallet__main {
  display: flex;
  flex-direction: column;
  padding: 20px 20px 24px;
}

.wallet__main .zone-head {
  margin-bottom: 22px;
}

.wallet__pending {
  margin-top: 10px;
  font: 600 13px/1.3 var(--fm-mono);
  color: var(--fm-amber-deep);
}

/* Senden und Empfangen nebeneinander, als Felder im Ticket */
.menu-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 22px;
}

.menu-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start; /* beide Kacheln oben bündig, auch bei ungleich langem Hinweis */
  gap: 4px;
  padding: 14px 14px 13px;
  border: var(--fm-line) solid var(--fm-ink);
  border-radius: var(--fm-radius);
  background: transparent;
  color: var(--fm-ink);
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease;
}

.menu-tile:hover {
  background: rgb(18 20 25 / 0.05);
}

.menu-tile:active {
  transform: translateY(1px);
}

.menu-tile:focus-visible {
  outline: 3px solid var(--fm-amber);
  outline-offset: 3px;
}

.menu-tile__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: 8px;
  border-radius: 50%;
  background: var(--fm-ink);
  color: var(--fm-amber);
}

.menu-tile__icon svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.menu-tile__label {
  font: 700 17px/1.15 var(--fm-sans);
  letter-spacing: -0.01em;
}

.menu-tile__hint {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--fm-ink-soft);
}

/* Abriss: Wallet-ID wie die Buchungsnummer auf dem Boarding Pass */
.wallet__stub {
  align-items: stretch;
  gap: 10px;
  width: 100%;
  padding: 20px 20px 22px;
  border: 0;
  background-color: var(--fm-paper); /* sonst gewinnt der dunkle Grundstil für Buttons */
  color: var(--fm-ink);
  font: inherit;
  text-align: left;
  cursor: copy;
}

.wallet__stub:focus-visible {
  outline: 3px solid var(--fm-amber);
  outline-offset: -6px;
}

.wallet__id-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.wallet__copy {
  font: 500 10px/1 var(--fm-mono);
  color: var(--fm-ink-soft);
}

.wallet__id {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 10px;
  font: 600 20px/1 var(--fm-mono);
  letter-spacing: 0.06em;
}

.wallet__barcode {
  display: block;
  width: 100%;
  height: 34px;
  fill: var(--fm-ink);
}

/* Profilbild groß */
.photo-dialog {
  width: min(420px, calc(100% - 32px));
  max-width: none;
  max-height: none;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
}

.photo-dialog::backdrop {
  background: rgb(7 9 17 / 0.82);
  backdrop-filter: blur(4px);
}

.photo-dialog[open] .photo-dialog__card {
  animation: photo-pop 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes photo-pop {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}

.photo-dialog__card {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 14px;
  padding: 22px 22px 20px;
  border-radius: var(--fm-radius-ticket);
  background: var(--fm-paper-sheen), var(--fm-paper);
  box-shadow: 0 30px 60px rgb(0 0 0 / 0.5);
}

.photo-dialog__image {
  display: block;
  width: min(100%, 62dvh);
  aspect-ratio: 1 / 1;
  border-radius: 18px;
  object-fit: cover;
  box-shadow: 0 0 0 1.5px var(--fm-ink);
}

.photo-dialog__close {
  position: absolute;
  top: -14px;
  right: -14px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--fm-ink);
  color: var(--fm-paper);
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.4);
  cursor: pointer;
}

.photo-dialog__close svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
}

.photo-dialog__close:hover {
  color: var(--fm-amber);
}

.photo-dialog__card .btn {
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .photo-dialog[open] .photo-dialog__card {
    animation: none;
  }
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
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
  <section class="step">
    <div class="account-badge card">
      <div class="account-badge__head">
        <button
          v-if="account.photo"
          type="button"
          class="account-badge__photo-btn"
          aria-label="Profilbild groß anzeigen"
          @click="openPhoto"
        >
          <img :src="account.photo" class="account-badge__photo" alt="" />
        </button>
        <p class="step__eyebrow">Willkommen, {{ account.username }}</p>
      </div>
      <div class="account-badge__row">
        <div>
          <p class="step__hint">Online</p>
          <p class="account-badge__balance">{{ account.balance }} €</p>
        </div>
        <div>
          <p class="step__hint">Offline</p>
          <p class="account-badge__balance">{{ offlineBalance }} €</p>
        </div>
      </div>
      <p v-if="pendingBalance > 0" class="step__hint">Ausstehend: {{ pendingBalance }} € (wartet auf Sync)</p>
      <p class="step__hint">Wallet {{ account.walletId.slice(0, 10) }}…</p>
      <div class="account-badge__actions">
        <button class="btn btn--primary" @click="emit('select', 'topup')">
          <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          Konto aufladen
        </button>
        <button class="btn sync-btn" :disabled="syncing || pendingBalance === 0" @click="sync">
          <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" />
            <path d="M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2" />
          </svg>
          <span>{{ syncing ? 'Sync …' : 'Sync' }}</span>
          <span v-if="pendingBalance > 0 && !syncing" class="sync-btn__badge">{{ pendingBalance }} €</span>
        </button>
      </div>
      <p v-if="syncMessage" class="step__success">{{ syncMessage }}</p>
      <p v-if="syncError" class="step__error">{{ syncError }}</p>
    </div>

    <div class="menu-grid">
      <button class="menu-tile" @click="emit('select', 'pay')">
        <span class="menu-tile__icon">
          <!-- Papierflieger: Geld fliegt los -->
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 3 3 10.5l7 2.8L13.5 21 21 3Z" />
            <path d="m10 13.3 5.5-5.5" />
          </svg>
        </span>
        <span class="menu-tile__label">Geld senden</span>
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
        <span class="menu-tile__label">Geld empfangen</span>
        <span class="menu-tile__hint">Betrag anfordern</span>
      </button>
    </div>

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
.account-badge {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.account-badge__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.account-badge__photo-btn {
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: zoom-in;
  transition: transform 0.15s ease;
}

.account-badge__photo-btn:active {
  transform: scale(0.94);
}

.account-badge__photo-btn:focus-visible {
  outline: 3px solid var(--fm-amber);
  outline-offset: 3px;
}

.account-badge__photo {
  display: block;
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 3px var(--fm-paper), 0 0 0 4.5px var(--fm-ink);
}

.account-badge__row {
  display: flex;
  gap: 32px;
  margin: 10px 0 6px;
  padding-top: 18px;
  border-top: var(--fm-line) solid var(--fm-ink);
}

/* Label über dem Betrag wie ein Ticketfeld */
.account-badge__row .step__hint {
  font-family: var(--fm-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.account-badge__balance {
  margin-top: 6px;
  font-size: 44px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.045em;
}

.account-badge__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto; /* Sync so breit wie nötig, Aufladen nimmt den Rest */
  gap: 10px;
  margin-top: 6px;
}

.account-badge__actions .btn {
  white-space: nowrap;
}

/* Sync: Symbol, Wort und Betrag in einer Zeile – der Betrag als kleines Badge */
.sync-btn {
  flex-wrap: nowrap;
  gap: 8px;
  padding-inline: 12px;
  white-space: nowrap;
}

.sync-btn__badge {
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--fm-amber);
  color: var(--fm-ink);
  font: 700 12px/1 var(--fm-sans);
  letter-spacing: 0;
}

.action-icon {
  flex: none;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Senden und Empfangen nebeneinander */
.menu-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.menu-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 18px 16px 16px;
  border: 0;
  border-radius: var(--fm-radius);
  background: var(--fm-paper-sheen), var(--fm-paper);
  color: var(--fm-ink);
  text-align: left;
  cursor: pointer;
  filter: drop-shadow(0 14px 30px rgb(0 0 0 / 0.45));
  transition: transform 0.15s ease;
}

.menu-tile:hover {
  transform: translateY(-2px);
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
  width: 48px;
  height: 48px;
  margin-bottom: 10px;
  border-radius: 50%;
  background: var(--fm-ink);
  color: var(--fm-amber);
}

.menu-tile__icon svg {
  width: 24px;
  height: 24px;
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

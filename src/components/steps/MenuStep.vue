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

async function sync() {
  const received = pendingTransactions.value.flatMap((tx) => tx.coins)
  if (received.length === 0) return

  syncing.value = true
  syncError.value = ''
  syncMessage.value = ''
  try {
    const result = await syncAccount(props.account.walletId, received)
    clearPendingTransactions()
    emit('synced', result.balance)
    syncMessage.value = `${result.credited} € gutgeschrieben.`
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
        <img v-if="account.photo" :src="account.photo" class="account-badge__photo" alt="" />
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
        <button class="btn" :disabled="syncing || pendingBalance === 0" @click="sync">
          <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" />
            <path d="M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2" />
          </svg>
          {{ syncing ? 'Sync …' : pendingBalance > 0 ? `Sync · ${pendingBalance} €` : 'Sync' }}
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

.account-badge__photo {
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
  grid-template-columns: 1.4fr 1fr;
  gap: 10px;
  margin-top: 6px;
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
</style>

<script setup lang="ts">
import type { Account } from '../../models/Account'
import { offlineBalance, pendingBalance } from '../../services/wallet'

defineProps<{ account: Account }>()
const emit = defineEmits<{ select: ['topup' | 'receive' | 'pay'] }>()
</script>

<template>
  <section class="step">
    <div class="account-badge card">
      <p class="step__eyebrow">Willkommen, {{ account.username }}</p>
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
    </div>

    <div class="menu-grid">
      <button class="menu-tile" @click="emit('select', 'topup')">
        <span class="menu-tile__icon">＋</span>
        <span>Aufladen</span>
      </button>
      <button class="menu-tile" @click="emit('select', 'receive')">
        <span class="menu-tile__icon">↓</span>
        <span>Bezahlt werden</span>
      </button>
      <button class="menu-tile" @click="emit('select', 'pay')">
        <span class="menu-tile__icon">↑</span>
        <span>Bezahlen</span>
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

.menu-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.menu-tile {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  padding: 18px 20px;
  border: 0;
  border-radius: var(--fm-radius);
  background: var(--fm-paper-sheen), var(--fm-paper);
  color: var(--fm-ink);
  font: 600 17px/1.2 var(--fm-sans);
  letter-spacing: -0.01em;
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
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--fm-ink);
  color: var(--fm-amber);
  font-size: 20px;
  font-weight: 700;
}
</style>

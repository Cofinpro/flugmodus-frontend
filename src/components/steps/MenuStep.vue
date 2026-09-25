<script setup lang="ts">
import type { Account } from '../../models/Account'

defineProps<{ account: Account }>()
const emit = defineEmits<{ select: ['topup' | 'receive' | 'pay'] }>()
</script>

<template>
  <section class="step">
    <div class="account-badge card">
      <div>
        <p class="step__eyebrow">Willkommen, {{ account.username }}</p>
        <p class="account-badge__balance">{{ account.balance }} €</p>
      </div>
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
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.account-badge__balance {
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.menu-grid {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.menu-tile {
  display: flex;
  align-items: center;
  gap: 1rem;
  font: inherit;
  font-weight: 600;
  font-size: 1.05rem;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.menu-tile:hover {
  background: var(--surface-strong);
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow);
}

.menu-tile__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
  color: #04121f;
  font-size: 1.3rem;
  font-weight: 700;
  flex-shrink: 0;
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import type { Account } from './models/Account'
import { resetWallet } from './services/wallet'
import BackendUrlStep from './components/steps/BackendUrlStep.vue'
import AccountStep from './components/steps/AccountStep.vue'
import MenuStep from './components/steps/MenuStep.vue'
import TopUpStep from './components/steps/TopUpStep.vue'
import ReceiveStep from './components/steps/ReceiveStep.vue'
import PayStep from './components/steps/PayStep.vue'

type Step = 'backend' | 'account' | 'menu' | 'topup' | 'receive' | 'pay'

const step = ref<Step>('backend')
const account = ref<Account | null>(null)

function onAccountCreated(created: Account) {
  account.value = created
  resetWallet()
  step.value = 'menu'
}

function onMenuSelect(target: 'topup' | 'receive' | 'pay') {
  step.value = target
}

function onTopUp(coinValue: number) {
  if (!account.value) return
  account.value.balance -= coinValue
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <span class="app-header__badge"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg></span>
      <h1>Flugmodus Bank</h1>
    </header>

    <main class="app-main">
      <BackendUrlStep v-if="step === 'backend'" @next="step = 'account'" />
      <AccountStep v-else-if="step === 'account'" @created="onAccountCreated" />
      <MenuStep v-else-if="step === 'menu' && account" :account="account" @select="onMenuSelect" />
      <TopUpStep
        v-else-if="step === 'topup' && account"
        :account="account"
        @back="step = 'menu'"
        @topup="onTopUp"
      />
      <ReceiveStep v-else-if="step === 'receive' && account" :account="account" @back="step = 'menu'" />
      <PayStep v-else-if="step === 'pay' && account" :account="account" @back="step = 'menu'" />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  /* über dem von sky.js erzeugten Himmel liegen */
  position: relative;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--fm-paper);
}

.app-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.app-header__badge {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--fm-paper);
  color: var(--fm-amber-deep);
  box-shadow: 0 0 0 4px rgb(255 181 71 / 0.18);
}

.app-header__badge svg {
  width: 20px;
  height: 20px;
  transform: rotate(45deg);
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>

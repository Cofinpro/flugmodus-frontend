<script setup lang="ts">
import { ref } from 'vue'
import type { Account } from './models/Account'
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
  step.value = 'menu'
}

function onMenuSelect(target: 'topup' | 'receive' | 'pay') {
  step.value = target
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <span class="app-header__badge">✈</span>
      <h1>Flugmodus Bank</h1>
    </header>

    <main class="app-main">
      <BackendUrlStep v-if="step === 'backend'" @next="step = 'account'" />
      <AccountStep v-else-if="step === 'account'" @created="onAccountCreated" />
      <MenuStep v-else-if="step === 'menu' && account" :account="account" @select="onMenuSelect" />
      <TopUpStep v-else-if="step === 'topup' && account" :account="account" @back="step = 'menu'" />
      <ReceiveStep v-else-if="step === 'receive' && account" :account="account" @back="step = 'menu'" />
      <PayStep v-else-if="step === 'pay'" @back="step = 'menu'" />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  padding: 1.5rem 1.25rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.app-header__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%);
  box-shadow: var(--shadow-glow);
  font-size: 1.3rem;
  transform: rotate(45deg);
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>

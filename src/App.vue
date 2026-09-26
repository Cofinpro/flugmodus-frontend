<script setup lang="ts">
import { ref } from 'vue'
import type { Account } from './models/Account'
import { resetWallet } from './services/wallet'
import { mood } from './services/mood'
import { isHttpUrl, setBackendUrl } from './services/backend'
import BackendUrlStep from './components/steps/BackendUrlStep.vue'
import AccountStep from './components/steps/AccountStep.vue'
import MenuStep from './components/steps/MenuStep.vue'
import TopUpStep from './components/steps/TopUpStep.vue'
import ReceiveStep from './components/steps/ReceiveStep.vue'
import PayStep from './components/steps/PayStep.vue'

type Step = 'backend' | 'account' | 'menu' | 'topup' | 'receive' | 'pay'

// Registrieren über den QR-Code der Landing Page: <App>/signup?backend=<Backend-Adresse>
// Dann ist die Bank schon bekannt, und es geht direkt zur Kontoerstellung mit Selfie.
function readSignupLink(): boolean {
  if (!location.pathname.replace(/\/+$/, '').endsWith('/signup')) return false
  const backend = new URLSearchParams(location.search).get('backend')
  history.replaceState(null, '', import.meta.env.BASE_URL) // Adresse aufräumen, ein Neuladen startet normal
  if (!backend || !isHttpUrl(backend)) return false
  setBackendUrl(backend)
  return true
}
const signup = readSignupLink()

const step = ref<Step>(signup ? 'account' : 'backend')
const account = ref<Account | null>(null)

function onAccountCreated(created: Account) {
  account.value = created
  resetWallet()
  step.value = 'menu'
}

function onMenuSelect(target: 'topup' | 'receive' | 'pay') {
  step.value = target
}

function onSynced(balance: number) {
  if (!account.value) return
  account.value.balance = balance
}

function onTopUp(coinValue: number) {
  if (!account.value) return
  account.value.balance -= coinValue
}
</script>

<template>
  <!-- Himmel-Stimmung: kurz warm bei Geldeingang, rot bei Doppelausgabe -->
  <div class="sky-mood" :class="mood && `sky-mood--${mood}`" aria-hidden="true"></div>
  <div class="app-shell">
    <header class="app-header">
      <span class="app-header__badge"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg></span>
      <h1>Flugmodus Wallet</h1>
    </header>

    <main class="app-main">
      <BackendUrlStep v-if="step === 'backend'" @next="step = 'account'" />
      <AccountStep v-else-if="step === 'account'" :with-photo="signup" @created="onAccountCreated" />
      <MenuStep v-else-if="step === 'menu' && account" :account="account" @select="onMenuSelect" @synced="onSynced" />
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
.sky-mood {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 1.4s ease;
}

.sky-mood--warm,
.sky-mood--alert {
  opacity: 1;
  transition-duration: 0.35s;
}

.sky-mood--warm {
  background:
    radial-gradient(120% 70% at 50% 110%, rgb(255 181 71 / 0.38), transparent 60%),
    radial-gradient(80% 50% at 50% -10%, rgb(255 214 165 / 0.14), transparent 70%);
}

.sky-mood--alert {
  background:
    radial-gradient(120% 70% at 50% 110%, rgb(194 56 31 / 0.5), transparent 60%),
    radial-gradient(80% 50% at 50% -10%, rgb(255 90 60 / 0.18), transparent 70%);
  animation: sky-alert 0.9s ease-in-out 2;
}

@keyframes sky-alert {
  50% {
    filter: brightness(1.6);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sky-mood--alert {
    animation: none;
  }
}

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

/* Handy: volle Höhe inkl. mitwandernder Adressleiste, Notch und Home-Leiste freilassen */
@media (hover: none) and (pointer: coarse) {
  .app-shell {
    min-height: 100dvh;
    padding: max(14px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
      max(14px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
    gap: 14px;
  }

  .app-header h1 {
    font-size: 18px;
  }

  .app-header__badge {
    width: 34px;
    height: 34px;
  }
}
</style>

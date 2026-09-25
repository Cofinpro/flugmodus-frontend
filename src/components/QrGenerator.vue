<script setup lang="ts">
import { ref } from 'vue'
import QRCode from 'qrcode'
import { createAccount } from '../services/account'
import { backendUrl } from '../services/backend'
import type { Account } from '../models/Account'
import type { Rfp } from '../models/Rfp'

const username = ref('')
const account = ref<Account | null>(null)
const accountError = ref('')
const creatingAccount = ref(false)

const amount = ref<number>(10)
const rfp = ref<Rfp | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

async function newAccount() {
  accountError.value = ''
  creatingAccount.value = true
  try {
    account.value = await createAccount(username.value)
    rfp.value = null
  } catch (e) {
    accountError.value = (e as Error).message
  } finally {
    creatingAccount.value = false
  }
}

async function generateRfp() {
  if (!account.value) return

  const created: Rfp = {
    amount: amount.value,
    pairReq: [],
    walletIdPaid: account.value.walletId,
  }
  rfp.value = created

  if (canvas.value) {
    await QRCode.toCanvas(canvas.value, JSON.stringify(created), { width: 240 })
  }
}
</script>

<template>
  <section>
    <h2>Konto</h2>
    <p>Backend: {{ backendUrl || 'nicht konfiguriert – bitte zuerst den QR-Code der Backend-URL scannen' }}</p>
    <input v-model="username" type="text" placeholder="Benutzername" />
    <button :disabled="!backendUrl || !username.trim() || creatingAccount" @click="newAccount">
      {{ creatingAccount ? 'Erstelle…' : 'Neues Konto erstellen' }}
    </button>
    <p v-if="accountError">{{ accountError }}</p>
    <template v-if="account">
      <p>Wallet-ID: {{ account.walletId }}</p>
      <p>Kontostand: {{ account.balance }}</p>
    </template>

    <h2>Zahlungsanfrage (RFP)</h2>
    <input type="number" v-model.number="amount" min="0" /> € -
    <button :disabled="!account" @click="generateRfp">RFP erstellen</button>
    <br />
    <canvas ref="canvas"></canvas>
    <pre v-if="rfp">{{ rfp }}</pre>
  </section>
</template>

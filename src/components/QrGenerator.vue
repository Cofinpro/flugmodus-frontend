<script setup lang="ts">
import { ref } from 'vue'
import QRCode from 'qrcode'
import { createAccount } from '../services/account'
import type { Account } from '../models/Account'
import type { Token } from '../models/Token'
import type { Rfp } from '../models/Rfp'

const account = ref<Account | null>(null)
const token = ref<Token | null>(null)
const amount = ref<number>(10)
const rfp = ref<Rfp | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

function newAccount() {
  const created = createAccount()
  account.value = created.account
  token.value = created.token
  rfp.value = null
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
    <button @click="newAccount">Neues Konto erstellen</button>
    <p v-if="account">Wallet-ID: {{ account.walletId }}</p>
    <p v-if="token">Signature: {{ token.signature }}</p>

    <h2>Zahlungsanfrage (RFP)</h2>
    <input type="number" v-model.number="amount" min="0" /> € -
    <button :disabled="!account" @click="generateRfp">RFP erstellen</button>
    <br />
    <canvas ref="canvas"></canvas>
    <pre v-if="rfp">{{ rfp }}</pre>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import QRCode from 'qrcode'
import { createAccount } from '../services/account'
import { backendUrl } from '../services/backend'
import { issueFinish, issueStart, type IssueFinishResult, type IssueSession } from '../services/issue'
import type { Account } from '../models/Account'
import type { Rfp } from '../models/Rfp'

const username = ref('')
const account = ref<Account | null>(null)
const accountError = ref('')
const creatingAccount = ref(false)

const issueSession = ref<IssueSession | null>(null)
const issueError = ref('')
const issuing = ref(false)

const finishResult = ref<IssueFinishResult | null>(null)
const finishError = ref('')
const finishing = ref(false)

const amount = ref<number>(10)
const rfp = ref<Rfp | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

async function newAccount() {
  accountError.value = ''
  creatingAccount.value = true
  try {
    account.value = await createAccount(username.value)
    rfp.value = null
    issueSession.value = null
    finishResult.value = null
  } catch (e) {
    accountError.value = (e as Error).message
  } finally {
    creatingAccount.value = false
  }
}

async function topUpAccount() {
  if (!account.value) return
  issueError.value = ''
  finishResult.value = null
  finishError.value = ''
  issuing.value = true
  try {
    issueSession.value = await issueStart(account.value.accountId, account.value.u)
  } catch (e) {
    issueError.value = (e as Error).message
  } finally {
    issuing.value = false
  }
}

async function finishTopUp() {
  if (!issueSession.value) return
  finishError.value = ''
  finishing.value = true
  try {
    finishResult.value = await issueFinish(issueSession.value)
  } catch (e) {
    finishError.value = (e as Error).message
  } finally {
    finishing.value = false
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

    <button :disabled="!account || issuing" @click="topUpAccount">
      {{ issuing ? 'Erzeuge Kandidaten…' : 'Konto aufladen' }}
    </button>
    <p v-if="issueError">{{ issueError }}</p>
    <template v-if="issueSession">
      <p>Session-ID: {{ issueSession.sessionId }}</p>
      <p>Kept-Candidate-Index: {{ issueSession.keptCandidateIndex }}</p>

      <button :disabled="finishing" @click="finishTopUp">
        {{ finishing ? 'Öffne Kandidaten…' : 'Abschließen' }}
      </button>
      <p v-if="finishError">{{ finishError }}</p>
      <p v-if="finishResult">Blind-Signature: {{ finishResult.blindSignature }}</p>
    </template>

    <h2>Zahlungsanfrage (RFP)</h2>
    <input type="number" v-model.number="amount" min="0" /> € -
    <button :disabled="!account" @click="generateRfp">RFP erstellen</button>
    <br />
    <canvas ref="canvas"></canvas>
    <pre v-if="rfp">{{ rfp }}</pre>
  </section>
</template>

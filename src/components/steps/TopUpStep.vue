<script setup lang="ts">
import { ref } from 'vue'
import { issueFinish, issueStart, type IssueFinishResult, type IssueSession } from '../../services/issue'
import type { Account } from '../../models/Account'

const COIN_VALUE = 1

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ back: []; topup: [number] }>()

const issueSession = ref<IssueSession | null>(null)
const issueError = ref('')
const issuing = ref(false)

const finishResult = ref<IssueFinishResult | null>(null)
const finishError = ref('')
const finishing = ref(false)

async function start() {
  issueError.value = ''
  finishResult.value = null
  finishError.value = ''
  issuing.value = true
  try {
    issueSession.value = await issueStart(
      props.account.accountId,
      props.account.u,
      props.account.bankPublicKey,
      props.account.bankExponent,
    )
  } catch (e) {
    issueError.value = (e as Error).message
  } finally {
    issuing.value = false
  }
}

async function finish() {
  if (!issueSession.value) return
  finishError.value = ''
  finishing.value = true
  try {
    finishResult.value = await issueFinish(issueSession.value)
    emit('topup', COIN_VALUE)
  } catch (e) {
    finishError.value = (e as Error).message
  } finally {
    finishing.value = false
  }
}
</script>

<template>
  <section class="step card">
    <button class="btn btn--ghost btn--back" @click="emit('back')">← Zurück</button>
    <p class="step__eyebrow">Aufladen</p>
    <h2>Konto aufladen</h2>
    <p class="step__hint">Erzeugt 100 geblendete Münz-Kandidaten und startet die Ausgabe bei der Bank.</p>

    <button class="btn btn--primary" :disabled="issuing" @click="start">
      {{ issuing ? 'Erzeuge Kandidaten…' : 'Aufladung starten' }}
    </button>
    <p v-if="issueError" class="step__error">{{ issueError }}</p>

    <template v-if="issueSession">
      <p class="step__hint">Session {{ issueSession.sessionId.slice(0, 12) }}…</p>
      <button class="btn btn--primary" :disabled="finishing" @click="finish">
        {{ finishing ? 'Öffne Kandidaten…' : 'Abschließen' }}
      </button>
      <p v-if="finishError" class="step__error">{{ finishError }}</p>
      <p v-if="finishResult" class="step__success">
        Aufgeladen! Signature {{ finishResult.blindSignature.slice(0, 20) }}…
      </p>
    </template>
  </section>
</template>

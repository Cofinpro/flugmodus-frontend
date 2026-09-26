<script setup lang="ts">
import { computed, ref } from 'vue'
import AmountPad from '../AmountPad.vue'
import StepNav from '../StepNav.vue'
import { issueFinish, issueStart } from '../../services/issue'
import type { Account } from '../../models/Account'

const COIN_VALUE = 1

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ back: []; topup: [number] }>()

const amount = ref(0)
const dialog = ref<HTMLDialogElement | null>(null)
const successDialog = ref<HTMLDialogElement | null>(null)

const running = ref(false)
const done = ref(0)
const total = ref(0)
const error = ref('')

const maxAmount = computed(() => Math.max(0, Math.floor(props.account.balance / COIN_VALUE)))

function askConfirm() {
  if (amount.value === 0) return
  dialog.value?.showModal()
}

function cancel() {
  dialog.value?.close()
}

function backToWallet() {
  successDialog.value?.close()
  emit('back')
}

// Pro Münze: Kandidaten erzeugen (issueStart), öffnen und signieren lassen (issueFinish)
async function confirm() {
  dialog.value?.close()
  running.value = true
  done.value = 0
  total.value = amount.value
  error.value = ''
  try {
    for (let i = 0; i < total.value; i++) {
      const session = await issueStart(
        props.account.accountId,
        props.account.u,
        props.account.bankPublicKey,
        props.account.bankExponent,
      )
      await issueFinish(session)
      emit('topup', COIN_VALUE)
      done.value++
    }
    amount.value = 0
    successDialog.value?.showModal()
  } catch (e) {
    error.value = `${done.value} von ${total.value} Münzen aufgeladen. Fehler: ${(e as Error).message}`
    amount.value = total.value - done.value
  } finally {
    running.value = false
  }
}
</script>

<template>
  <section class="step card">
    <StepNav eyebrow="Aufladen" title="Konto aufladen" @back="emit('back')" />

    <AmountPad
      v-model="amount"
      :max="maxAmount"
      :hint="`Verfügbar: ${maxAmount} € · 1 Münze = 1 €`"
      :limit-text="`Maximal ${maxAmount} € verfügbar.`"
      :disabled="running"
    />

    <button class="btn btn--primary" :disabled="amount === 0 || running" @click="askConfirm">
      {{ running ? `Münze ${Math.min(done + 1, total)} von ${total} …` : 'Aufladen' }}
    </button>

    <div v-if="running" class="topup-progress" role="progressbar" :aria-valuenow="done" :aria-valuemax="total">
      <span :style="{ width: `${(done / total) * 100}%` }"></span>
    </div>
    <p v-if="error" class="step__error">{{ error }}</p>

    <dialog ref="dialog" class="topup-dialog" @cancel.prevent="cancel">
      <p class="step__eyebrow">Bestätigen</p>
      <h3>Möchtest du {{ amount }} € aufladen?</h3>
      <p class="step__hint">{{ amount }} {{ amount === 1 ? 'Münze' : 'Münzen' }} à 1 € werden bei der BesteBank abgehoben.</p>
      <div class="topup-dialog__actions">
        <button class="btn topup-dialog__yes" @click="confirm">Ja</button>
        <button class="btn topup-dialog__cancel" @click="cancel">Abbrechen</button>
      </div>
    </dialog>

    <dialog ref="successDialog" class="topup-dialog" @cancel.prevent="backToWallet">
      <p class="step__eyebrow">Erledigt</p>
      <h3>Aufgeladen!</h3>
      <p class="step__hint">{{ total }} € {{ total === 1 ? 'ist' : 'sind' }} jetzt in deiner Wallet.</p>
      <div class="topup-dialog__actions">
        <button class="btn btn--primary" @click="backToWallet">Zurück</button>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.topup-progress {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--fm-paper-edge);
}

.topup-progress span {
  display: block;
  height: 100%;
  background: var(--fm-amber-deep);
  transition: width 0.3s ease;
}

/* Modal: Papier aus fm-skin, Ja grün, Abbrechen grau */
.topup-dialog {
  width: min(360px, calc(100% - 32px));
}

.topup-dialog h3 {
  margin: 8px 0 8px;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.topup-dialog__actions {
  display: grid;
  gap: 10px;
  margin-top: 22px;
}

.topup-dialog__yes {
  border-color: var(--fm-ink);
  background: var(--fm-green);
  color: var(--fm-ink);
}

.topup-dialog__yes:hover:not(:disabled) {
  background: #19a95c;
  color: var(--fm-ink);
}

.topup-dialog__cancel {
  border-color: transparent;
  background: var(--fm-paper-edge);
  color: var(--fm-ink);
}

.topup-dialog__cancel:hover:not(:disabled) {
  background: #d6ccb9;
  color: var(--fm-ink);
}
</style>

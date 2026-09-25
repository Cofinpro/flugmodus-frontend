<script setup lang="ts">
import { ref } from 'vue'
import QRCode from 'qrcode'
import type { Account } from '../../models/Account'
import type { Rfp } from '../../models/Rfp'

const props = defineProps<{ account: Account }>()
const emit = defineEmits<{ back: [] }>()

const amount = ref<number>(10)
const rfp = ref<Rfp | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)

async function generate() {
  const created: Rfp = {
    amount: amount.value,
    pairReq: [],
    walletIdPaid: props.account.walletId,
  }
  rfp.value = created

  if (canvas.value) {
    await QRCode.toCanvas(canvas.value, JSON.stringify(created), { width: 280 })
  }
}
</script>

<template>
  <section class="step card">
    <button class="btn btn--ghost btn--back" @click="emit('back')">← Zurück</button>
    <p class="step__eyebrow">Bezahlt werden</p>
    <h2>Zahlungsanfrage erstellen</h2>

    <div class="field-row">
      <input type="number" v-model.number="amount" min="0" />
      <span>€</span>
      <button class="btn btn--ghost" style="width: auto" @click="generate">Erstellen</button>
    </div>

    <canvas ref="canvas" class="qr-canvas"></canvas>
    <p v-if="rfp" class="step__success">Lass das andere Gerät diesen Code scannen.</p>
  </section>
</template>

<style scoped>
.qr-canvas {
  align-self: center;
  border-radius: var(--radius-sm);
  overflow: hidden;
}
</style>

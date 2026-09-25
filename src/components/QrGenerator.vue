<script setup lang="ts">
import { onMounted, ref } from 'vue'
import QRCode from 'qrcode'

const text = ref('')
const canvas = ref<HTMLCanvasElement | null>(null)

function randomText(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function generate() {
  text.value = randomText()
  if (canvas.value) {
    await QRCode.toCanvas(canvas.value, text.value, { width: 240 })
  }
}

onMounted(generate)
</script>

<template>
  <section>
    <h2>QR-Code Generator</h2>
    <button @click="generate">Neuer Code</button>
    <canvas ref="canvas"></canvas>
    <p>{{ text }}</p>
  </section>
</template>

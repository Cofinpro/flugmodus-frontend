<script setup lang="ts">
import { ref, watch } from 'vue'
import { backendUrl, setBackendUrl } from '../services/backend'

const input = ref(backendUrl.value)

watch(backendUrl, (value) => {
  input.value = value
})

function save() {
  setBackendUrl(input.value)
}
</script>

<template>
  <section>
    <h2>Backend</h2>
    <input v-model="input" type="url" placeholder="https://xxxx.ngrok-free.app" @keyup.enter="save" />
    <button @click="save">Speichern</button>
    <p>Aktuell: {{ backendUrl || 'nicht konfiguriert' }}</p>
  </section>
</template>

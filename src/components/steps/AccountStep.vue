<script setup lang="ts">
import { ref } from 'vue'
import { createAccount } from '../../services/account'
import { backendUrl } from '../../services/backend'
import type { Account } from '../../models/Account'

const emit = defineEmits<{ created: [Account] }>()

const username = ref('')
const error = ref('')
const creating = ref(false)

async function create() {
  if (!username.value.trim()) return
  error.value = ''
  creating.value = true
  try {
    const account = await createAccount(username.value.trim())
    emit('created', account)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <section class="step card">
    <p class="step__eyebrow">Schritt 2 von 3</p>
    <h2>Konto erstellen</h2>
    <p class="step__hint">Verbunden mit {{ backendUrl }}</p>

    <input v-model="username" type="text" placeholder="Benutzername" @keyup.enter="create" />
    <button class="btn btn--primary" :disabled="!username.trim() || creating" @click="create">
      {{ creating ? 'Erstelle…' : 'Konto erstellen' }}
    </button>
    <p v-if="error" class="step__error">{{ error }}</p>
  </section>
</template>

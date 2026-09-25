<script setup lang="ts">
import { ref } from 'vue'
import CatEarsCamera from '../CatEarsCamera.vue'
import { createAccount } from '../../services/account'
import { backendUrl } from '../../services/backend'
import type { Account } from '../../models/Account'

// withPhoto: Registrieren über den Link der Landing Page – erst Selfie mit Katzenohren, dann der Name
const props = defineProps<{ withPhoto?: boolean }>()
const emit = defineEmits<{ created: [Account] }>()

const username = ref('')
const error = ref('')
const creating = ref(false)
const photo = ref('')
const photoStep = ref(props.withPhoto)

function onPhoto(dataUrl: string) {
  photo.value = dataUrl
  photoStep.value = false
}

async function create() {
  if (!username.value.trim()) return
  error.value = ''
  creating.value = true
  try {
    const account = await createAccount(username.value.trim(), photo.value || undefined)
    emit('created', photo.value ? { ...account, photo: photo.value } : account)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <section class="step card">
    <template v-if="photoStep">
      <p class="step__eyebrow">Registrieren · 1 von 2</p>
      <h2>Kurz lächeln</h2>
      <p class="step__hint">Ein Foto für deine Bordkarte – die Katzenohren gibt's gratis dazu.</p>
      <CatEarsCamera @photo="onPhoto" @skip="photoStep = false" />
    </template>

    <template v-else>
      <p class="step__eyebrow">{{ withPhoto ? 'Registrieren · 2 von 2' : 'Schritt 2 von 3' }}</p>
      <h2>Konto erstellen</h2>
      <img v-if="photo" :src="photo" class="account-photo" alt="Dein Foto mit Katzenohren" />
      <p class="step__hint">Verbunden mit {{ backendUrl }}</p>

      <input v-model="username" type="text" placeholder="Benutzername" @keyup.enter="create" />
      <button class="btn btn--primary" :disabled="!username.trim() || creating" @click="create">
        {{ creating ? 'Erstelle…' : 'Konto erstellen' }}
      </button>
      <p v-if="error" class="step__error">{{ error }}</p>
    </template>
  </section>
</template>

<style scoped>
.account-photo {
  align-self: center;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 4px var(--fm-paper), 0 0 0 5.5px var(--fm-ink);
}
</style>

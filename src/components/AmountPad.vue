<script setup lang="ts">
import { ref } from 'vue'

// Betrag in ganzen Euro per Ziffernblock – ohne Komma, nie mehr als max
const MAX_DIGITS = 3

const props = defineProps<{
  modelValue: number
  max: number
  hint: string // unter dem Betrag, z. B. „Verfügbar: 97 €“
  limitText: string // wenn eine Ziffer über max hinausgehen würde
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [number] }>()

const limitHint = ref('')

function press(digit: number) {
  if (props.disabled) return
  const next = props.modelValue * 10 + digit
  if (String(next).length > MAX_DIGITS || next > props.max) {
    limitHint.value = props.limitText
    return
  }
  limitHint.value = ''
  emit('update:modelValue', next)
}

function clear() {
  limitHint.value = ''
  emit('update:modelValue', 0)
}

function backspace() {
  limitHint.value = ''
  emit('update:modelValue', Math.floor(props.modelValue / 10))
}
</script>

<template>
  <div class="amount-display" aria-live="polite">
    <span class="fm-amount" :class="{ 'amount-display--zero': modelValue === 0 }">{{ modelValue }}<small>€</small></span>
    <p class="step__hint">{{ hint }}</p>
    <p v-if="limitHint" class="amount-limit">{{ limitHint }}</p>
  </div>

  <div class="numpad" role="group" aria-label="Ziffernblock">
    <button
      v-for="digit in [1, 2, 3, 4, 5, 6, 7, 8, 9]"
      :key="digit"
      class="numpad__key"
      :disabled="disabled"
      @click="press(digit)"
    >
      {{ digit }}
    </button>
    <button class="numpad__key numpad__key--soft" :disabled="disabled" aria-label="Löschen" @click="clear">C</button>
    <button class="numpad__key" :disabled="disabled" @click="press(0)">0</button>
    <button class="numpad__key numpad__key--soft" :disabled="disabled" aria-label="Letzte Ziffer löschen" @click="backspace">
      ⌫
    </button>
  </div>
</template>

<style scoped>
.amount-display {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 8px 0 4px;
  text-align: center;
}

.amount-display--zero {
  color: var(--fm-ink-soft);
}

.amount-limit {
  font-size: 14px;
  color: var(--fm-red);
}

/* Ziffernblock wie Ticket-Kacheln: Kontur, beim Drücken Tinte */
.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.numpad__key {
  height: 60px;
  border: var(--fm-line) solid var(--fm-ink);
  border-radius: var(--fm-radius);
  background: transparent;
  color: var(--fm-ink);
  font: 700 24px/1 var(--fm-sans);
  letter-spacing: -0.02em;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
  -webkit-tap-highlight-color: transparent;
}

.numpad__key:active:not(:disabled) {
  background: var(--fm-ink);
  color: var(--fm-amber);
  transform: translateY(1px);
}

.numpad__key:focus-visible {
  outline: 3px solid var(--fm-amber);
  outline-offset: 2px;
}

.numpad__key:disabled {
  opacity: 0.45;
  cursor: default;
}

.numpad__key--soft {
  border-color: var(--fm-paper-edge);
  font: 600 18px/1 var(--fm-mono);
  color: var(--fm-ink-soft);
}

/* Handy: Tasten wachsen mit der Bildschirmhöhe, damit Numpad und Knopf auf einen Screen passen */
@media (hover: none) and (pointer: coarse) {
  .numpad {
    gap: 8px;
  }

  .numpad__key {
    height: clamp(44px, 7dvh, 60px);
  }
}
</style>

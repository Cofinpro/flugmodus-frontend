<script setup lang="ts">
// Kopfzeile eines Schritts: großer runder Zurück-Knopf links, Überschrift daneben
defineProps<{ eyebrow: string; title: string }>()
const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <header class="step-nav">
    <button class="step-nav__back" type="button" aria-label="Zurück" @click="emit('back')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
    </button>
    <div class="step-nav__text">
      <p class="step__eyebrow">{{ eyebrow }}</p>
      <h2>{{ title }}</h2>
    </div>
  </header>
</template>

<style scoped>
.step-nav {
  display: flex;
  align-items: center;
  gap: 14px;
}

.step-nav__text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.step-nav__back {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  border: var(--fm-line) solid var(--fm-ink);
  border-radius: 50%;
  background: transparent;
  color: var(--fm-ink);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
}

.step-nav__back svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.step-nav__back:hover,
.step-nav__back:active {
  background: var(--fm-ink);
  color: var(--fm-amber);
}

.step-nav__back:active {
  transform: translateX(-1px);
}

.step-nav__back:focus-visible {
  outline: 3px solid var(--fm-amber);
  outline-offset: 2px;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'

// Betrag wie auf der Abflugtafel am Flughafen: jede Ziffer auf einem eigenen Klappblatt.
// Ändert sich eine Ziffer, klappt nur dieses Blatt um. Gezählt wird von rechts,
// damit bei 9 → 10 nicht alle Blätter neu klappen.
const props = withDefaults(defineProps<{ value: number; variant?: 'paper' | 'sky'; unit?: string }>(), {
  variant: 'paper',
  unit: '€',
})

const digits = computed(() => {
  const chars = String(props.value).split('')
  return chars.map((char, i) => ({ char, key: `${chars.length - i}-${char}` }))
})
</script>

<template>
  <span class="flap" :class="`flap--${variant}`" :aria-label="`${value} ${unit}`" role="text">
    <span v-for="digit in digits" :key="digit.key" class="flap__tile" aria-hidden="true">{{ digit.char }}</span>
    <span class="flap__unit" aria-hidden="true">{{ unit }}</span>
  </span>
</template>

<style scoped>
.flap {
  --tile: #16181f;
  --tile-top: #20232c;
  --digit: var(--fm-paper);
  display: inline-flex;
  align-items: stretch;
  gap: 0.08em;
  font: 700 1em/1 var(--fm-mono);
  font-variant-numeric: tabular-nums;
}

/* auf dem Himmel: Glasblätter statt schwarzer Blätter */
.flap--sky {
  --tile: rgb(255 255 255 / 0.07);
  --tile-top: rgb(255 255 255 / 0.12);
}

.flap__tile {
  position: relative;
  display: grid;
  place-items: center;
  width: 0.78em;
  height: 1.12em;
  border-radius: 0.12em;
  background: linear-gradient(var(--tile-top) 50%, var(--tile) 50%);
  color: var(--digit);
  box-shadow: inset 0 -0.04em 0 rgb(0 0 0 / 0.35), 0 0.06em 0.14em rgb(0 0 0 / 0.25);
  transform-origin: 50% 50%;
  animation: flap-in 0.45s cubic-bezier(0.3, 1.3, 0.5, 1) both;
}

/* die Klappe in der Mitte */
.flap__tile::after {
  content: '';
  position: absolute;
  inset: 50% 0 auto;
  height: max(1px, 0.035em);
  background: rgb(0 0 0 / 0.55);
}

.flap__unit {
  align-self: flex-end;
  margin-left: 0.12em;
  padding-bottom: 0.08em;
  font: 700 0.42em/1 var(--fm-sans);
  color: var(--fm-amber-deep);
}

.flap--sky .flap__unit {
  color: var(--fm-amber);
}

@keyframes flap-in {
  from {
    transform: perspective(200px) rotateX(-95deg);
    filter: brightness(0.6);
  }
}

@media (prefers-reduced-motion: reduce) {
  .flap__tile {
    animation: none;
  }
}
</style>

<script setup lang="ts">
// Stempel wie am Gate: knallt schräg aufs Papier, leicht fleckig wie echte Tinte
withDefaults(defineProps<{ text: string; tone?: 'ink' | 'red' | 'green'; delay?: number }>(), {
  tone: 'ink',
  delay: 150,
})
</script>

<template>
  <span class="ink-stamp" :class="`ink-stamp--${tone}`" :style="{ animationDelay: `${delay}ms` }" aria-hidden="true">
    {{ text }}
  </span>
</template>

<style scoped>
.ink-stamp {
  --tone: var(--fm-ink);
  display: inline-block;
  padding: 7px 12px 6px;
  border: 3px solid var(--tone);
  border-radius: 8px;
  outline: 1.5px solid var(--tone);
  outline-offset: 3px;
  color: var(--tone);
  font: 700 17px/1 var(--fm-mono);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  white-space: nowrap;
  opacity: 0.82;
  transform: rotate(-11deg);
  pointer-events: none;
  /* Tinte nimmt nicht überall gleich an: Rauschen als Maske */
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='4'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.6 2.1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='4'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.6 2.1'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  animation: stamp-in 0.5s cubic-bezier(0.3, 1.4, 0.5, 1) both;
}

.ink-stamp--red {
  --tone: var(--fm-red);
}

.ink-stamp--green {
  --tone: #13854a;
}

@keyframes stamp-in {
  0% {
    opacity: 0;
    transform: rotate(-11deg) scale(2.6);
  }
  60% {
    opacity: 0.9;
    transform: rotate(-11deg) scale(0.92);
  }
  100% {
    opacity: 0.82;
    transform: rotate(-11deg) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ink-stamp {
    animation: none;
  }
}
</style>

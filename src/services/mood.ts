import { ref } from 'vue'

// Stimmung des Himmels: kurz warm, wenn Geld ankommt, kurz rot bei einer Doppelausgabe
export type Mood = 'warm' | 'alert'

export const mood = ref<Mood | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
export function flashMood(kind: Mood, ms = 2800) {
  mood.value = kind
  clearTimeout(timer)
  timer = setTimeout(() => (mood.value = null), ms)
}

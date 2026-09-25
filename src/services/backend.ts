import { ref } from 'vue'

const STORAGE_KEY = 'flugmodus.backendUrl'

export const backendUrl = ref(localStorage.getItem(STORAGE_KEY) ?? 'http://127.0.0.1:8000')

// Für jeden Aufruf ans Backend. Der ngrok-Header ist nötig: sonst liefert ngrok (Free-Plan) Browsern
// statt der API-Antwort eine HTML-Warnseite, und jeder Aufruf aus der App scheitert.
export const API_HEADERS = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }

export function setBackendUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, '')
  backendUrl.value = trimmed
  localStorage.setItem(STORAGE_KEY, trimmed)
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

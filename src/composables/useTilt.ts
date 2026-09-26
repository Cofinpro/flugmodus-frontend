import { onBeforeUnmount, onMounted, type Ref } from 'vue'

// Leichtes Kippen wie eine echte Karte in der Hand, dazu ein wandernder Glanz.
// Desktop: folgt der Maus über dem Element. Handy: folgt der Neigung des Geräts
// (iOS fragt beim ersten Antippen einmal nach Erlaubnis). Schreibt nur CSS-Variablen:
// --tilt-x / --tilt-y (Grad) und --sheen-x / --sheen-y (Prozent).
export function useTilt(target: Ref<HTMLElement | null>, maxDeg = 5) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let frame = 0

  function apply(x: number, y: number) {
    // x, y jeweils -1 … 1
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const el = target.value
      if (!el) return
      el.style.setProperty('--tilt-x', `${(-y * maxDeg).toFixed(2)}deg`)
      el.style.setProperty('--tilt-y', `${(x * maxDeg).toFixed(2)}deg`)
      el.style.setProperty('--sheen-x', `${(50 + x * 45).toFixed(1)}%`)
      el.style.setProperty('--sheen-y', `${(50 + y * 45).toFixed(1)}%`)
    })
  }

  const clamp = (v: number) => Math.max(-1, Math.min(1, v))

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || !target.value) return
    const rect = target.value.getBoundingClientRect()
    apply(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1)
  }

  function onPointerLeave() {
    apply(0, 0)
  }

  function onOrientation(event: DeviceOrientationEvent) {
    if (event.beta == null || event.gamma == null) return
    // übliche Haltung: ca. 45° nach hinten geneigt
    apply(clamp(event.gamma / 25), clamp((event.beta - 45) / 25))
  }

  type PermissionAware = { requestPermission?: () => Promise<'granted' | 'denied'> }
  async function askOrientationPermission() {
    const api = (window.DeviceOrientationEvent as unknown as PermissionAware | undefined)?.requestPermission
    if (!api) return
    try {
      if ((await api()) === 'granted') window.addEventListener('deviceorientation', onOrientation)
    } catch {
      // abgelehnt oder nicht unterstützt – dann bleibt die Karte eben gerade
    }
  }

  onMounted(() => {
    const el = target.value
    if (reduced || !el) return
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerleave', onPointerLeave)
    const needsPermission = !!(window.DeviceOrientationEvent as unknown as PermissionAware | undefined)?.requestPermission
    if (needsPermission) el.addEventListener('pointerdown', askOrientationPermission, { once: true })
    else window.addEventListener('deviceorientation', onOrientation)
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    const el = target.value
    el?.removeEventListener('pointermove', onPointerMove)
    el?.removeEventListener('pointerleave', onPointerLeave)
    el?.removeEventListener('pointerdown', askOrientationPermission)
    window.removeEventListener('deviceorientation', onOrientation)
  })
}

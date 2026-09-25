<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Selfie mit Katzenohren: Frontkamera, Gesichts-Oval als Hilfe, Ohren werden ins Foto gezeichnet.
// Kann der Browser Gesichter erkennen (FaceDetector, z. B. Chrome auf Android), sitzen die Ohren
// genau auf dem Kopf – sonst über dem Oval.
const emit = defineEmits<{ photo: [string]; skip: [] }>()

const SIZE = 640 // Kantenlänge des Fotos in Pixeln
// Lage des Ovals im quadratischen Bild (Anteile), muss zu .selfie__oval im CSS passen
const GUIDE = { x: 0.24, y: 0.16, width: 0.52 }

const video = ref<HTMLVideoElement | null>(null)
const photo = ref('')
const error = ref('')
const ready = ref(false)
let stream: MediaStream | null = null

async function start() {
  error.value = ''
  ready.value = false
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    })
    if (!video.value) return
    video.value.srcObject = stream
    await video.value.play()
    ready.value = true
  } catch {
    error.value = 'Die Kamera ist nicht verfügbar. Du kannst auch ohne Foto weitermachen.'
  }
}

function stop() {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
}

interface Head {
  x: number
  y: number
  width: number
}

// Gesicht im fertigen (gespiegelten) Bild suchen; ohne FaceDetector das Oval nehmen
async function findHead(canvas: HTMLCanvasElement): Promise<Head> {
  const guide = { x: GUIDE.x * SIZE, y: GUIDE.y * SIZE, width: GUIDE.width * SIZE }
  const Detector = (window as unknown as { FaceDetector?: new (o: object) => { detect(i: CanvasImageSource): Promise<{ boundingBox: DOMRectReadOnly }[]> } }).FaceDetector
  if (!Detector) return guide
  try {
    const [face] = await new Detector({ fastMode: true, maxDetectedFaces: 1 }).detect(canvas)
    if (!face) return guide
    const box = face.boundingBox
    // Gesichtsbox beginnt etwa an der Stirn – die Ohren gehören ein Stück höher auf den Kopf
    return { x: box.x, y: box.y - box.height * 0.28, width: box.width }
  } catch {
    return guide
  }
}

function drawEar(ctx: CanvasRenderingContext2D, cx: number, baseY: number, size: number, tilt: number) {
  ctx.save()
  ctx.translate(cx, baseY)
  ctx.rotate(tilt)
  const w = size * 0.5
  const h = size
  const ear = (scale: number, color: string, lift = 0) => {
    ctx.beginPath()
    ctx.moveTo(-w * scale, -lift)
    ctx.quadraticCurveTo(-w * scale * 0.35, -h * scale * 0.95 - lift, 0, -h * scale - lift)
    ctx.quadraticCurveTo(w * scale * 0.35, -h * scale * 0.95 - lift, w * scale, -lift)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }
  ear(1, '#121419') // Tinte
  ear(0.55, '#f2a7b8', size * 0.08) // rosa Innenohr
  ctx.restore()
}

function drawEars(ctx: CanvasRenderingContext2D, head: Head) {
  const size = head.width * 0.46
  const baseY = head.y + size * 0.3
  drawEar(ctx, head.x + head.width * 0.2, baseY, size, -0.32)
  drawEar(ctx, head.x + head.width * 0.8, baseY, size, 0.32)
}

async function capture() {
  const v = video.value
  if (!v || !v.videoWidth) return
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  // quadratischer Ausschnitt aus der Mitte, gespiegelt wie in der Vorschau
  const side = Math.min(v.videoWidth, v.videoHeight)
  ctx.translate(SIZE, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, SIZE, SIZE)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  drawEars(ctx, await findHead(canvas))
  photo.value = canvas.toDataURL('image/jpeg', 0.85)
  stop()
}

function retake() {
  photo.value = ''
  start()
}

onMounted(start)
onBeforeUnmount(stop)
</script>

<template>
  <div class="selfie">
    <div class="selfie__frame">
      <img v-if="photo" :src="photo" class="selfie__image" alt="Dein Foto mit Katzenohren" />
      <template v-else>
        <video ref="video" class="selfie__image selfie__video" playsinline muted></video>
        <div class="selfie__oval" aria-hidden="true">
          <svg class="selfie__ears" viewBox="0 0 100 40" aria-hidden="true">
            <path d="M6 38 Q10 6 22 2 Q30 10 34 38 Z" fill="#121419" />
            <path d="M13 36 Q16 16 22 12 Q27 18 29 36 Z" fill="#f2a7b8" />
            <path d="M94 38 Q90 6 78 2 Q70 10 66 38 Z" fill="#121419" />
            <path d="M87 36 Q84 16 78 12 Q73 18 71 36 Z" fill="#f2a7b8" />
          </svg>
        </div>
      </template>
    </div>

    <p v-if="error" class="step__error">{{ error }}</p>

    <div class="selfie__actions">
      <template v-if="photo">
        <button class="btn btn--primary" @click="emit('photo', photo)">Foto nehmen</button>
        <button class="btn btn--ghost" @click="retake">Nochmal</button>
      </template>
      <template v-else>
        <button class="btn btn--primary" :disabled="!ready" @click="capture">Foto machen</button>
        <button class="btn btn--ghost" @click="emit('skip')">Ohne Foto weiter</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.selfie {
  display: grid;
  gap: 14px;
}

/* wie der Kamerarahmen: weißer Rand, Tintenlinie, Amber-Ecken */
.selfie__frame {
  position: relative;
  align-self: center;
  justify-self: center;
  width: min(100%, 320px);
  padding: 10px;
  border-radius: 20px;
  background: #fff;
  box-shadow: inset 0 0 0 var(--fm-line) var(--fm-ink);
}

.selfie__frame::before,
.selfie__frame::after {
  content: '';
  position: absolute;
  width: 30px;
  height: 30px;
  border: 3px solid var(--fm-amber-deep);
}

.selfie__frame::before {
  top: -9px;
  left: -9px;
  border-right: 0;
  border-bottom: 0;
  border-radius: 12px 0 0 0;
}

.selfie__frame::after {
  right: -9px;
  bottom: -9px;
  border-left: 0;
  border-top: 0;
  border-radius: 0 0 12px 0;
}

.selfie__image {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  object-fit: cover;
  background: var(--fm-ink);
}

.selfie__video {
  transform: scaleX(-1); /* wie ein Spiegel */
}

/* Gesichts-Oval mit Ohren – gleiche Lage wie GUIDE im Skript */
.selfie__oval {
  position: absolute;
  left: calc(10px + (100% - 20px) * 0.24);
  top: calc(10px + (100% - 20px) * 0.16);
  width: calc((100% - 20px) * 0.52);
  aspect-ratio: 3 / 4;
  border: 2px dashed rgb(255 255 255 / 0.75);
  border-radius: 50%;
  pointer-events: none;
}

.selfie__ears {
  position: absolute;
  left: -2%;
  bottom: 92%;
  width: 104%;
}

.selfie__actions {
  display: grid;
  gap: 10px;
}

@media (hover: none) and (pointer: coarse) {
  .selfie__frame {
    width: clamp(180px, calc(100dvh - 430px), 320px);
  }
}
</style>

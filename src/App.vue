<script setup lang="ts">
import BackendConfig from './components/BackendConfig.vue'
import QrGenerator from './components/QrGenerator.vue'
import QrScanner from './components/QrScanner.vue'
</script>

<template>
  <main>
    <h1>Flugmodus</h1>
    <BackendConfig />
    <QrGenerator />
    <QrScanner />
  </main>
</template>

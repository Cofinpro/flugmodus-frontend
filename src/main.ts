// Styles zuerst: die scoped Styles der Komponenten müssen danach kommen, um zu gewinnen
import '../design/flugmodus.css'
import '../design/sky.js'
import './assets/theme.css'
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')

// @Time    : 2026/10/19 14:55
// @Author  : fzf
// @FileName: main.js
// @Software: deepin-desktop-manager

import { createApp } from 'vue'
import { createDiscreteApi, darkTheme, lightTheme } from 'naive-ui'
import App from './App.vue'
import './styles/global.css'

// Naive UI 离散 API（不用整包挂载，保持轻量）
const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: { theme: lightTheme }
})

const app = createApp(App)
app.provide('message', message)
app.provide('dialog', dialog)
app.mount('#app')

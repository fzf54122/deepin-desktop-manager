// @Time    : 2026/10/19 15:35
// @Author  : fzf
// @FileName: theme.js
// @Software: deepin-desktop-manager

import { reactive, watch } from 'vue'

/**
 * 完整主题系统：每套主题定义
 * - bg / bg-deep：双层背景（窗口 / 侧栏压暗），制造层次
 * - surface / surface-hover / surface-active：表面三态
 * - border / border-strong：分隔线与描边
 * - text / text-sub：正文与次要文字
 * - accent / accent-soft / accent-contrast：主色、主色底、主色上文字
 * - shadow：卡片投影（深色主题用更重的黑）
 * - naivePrimary / naiveTheme：naive-ui 组件联动
 */
export const themes = {
  light: {
    label: '浅色',
    naivePrimary: '#3b82f6',
    vars: {
      '--dm-bg': '#f8fafc',
      '--dm-bg-deep': '#ffffff',
      '--dm-surface': '#ffffff',
      '--dm-surface-hover': '#f1f5f9',
      '--dm-surface-active': '#e8f0fe',
      '--dm-border': '#eef2f6',
      '--dm-border-strong': '#dbe2ea',
      '--dm-text': '#0f172a',
      '--dm-text-sub': '#94a3b8',
      '--dm-accent': '#3b82f6',
      '--dm-accent-soft': '#e8f0fe',
      '--dm-accent-contrast': '#ffffff',
      '--dm-danger': '#ef4444',
      '--dm-shadow': '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)'
    }
  },
  dark: {
    label: '深色',
    naivePrimary: '#60a5fa',
    vars: {
      '--dm-bg': '#0b1120',
      '--dm-bg-deep': '#070b16',
      '--dm-surface': '#16203a',
      '--dm-surface-hover': '#1c2947',
      '--dm-surface-active': '#24345c',
      '--dm-border': '#26324e',
      '--dm-border-strong': '#3a4a6e',
      '--dm-text': '#e5e9f2',
      '--dm-text-sub': '#8b96ad',
      '--dm-accent': '#60a5fa',
      '--dm-accent-soft': 'rgba(96, 165, 250, 0.16)',
      '--dm-accent-contrast': '#0b1120',
      '--dm-danger': '#f87171',
      '--dm-shadow': '0 2px 8px rgba(0, 0, 0, 0.45), 0 8px 24px rgba(0, 0, 0, 0.35)'
    }
  },
  green: {
    label: '护眼绿',
    naivePrimary: '#3d7a4e',
    vars: {
      '--dm-bg': '#dde7d8',
      '--dm-bg-deep': '#d1ddca',
      '--dm-surface': '#f4f8ef',
      '--dm-surface-hover': '#eaf2e3',
      '--dm-surface-active': '#dfeadb',
      '--dm-border': '#c8d6c0',
      '--dm-border-strong': '#a8bfa0',
      '--dm-text': '#28361f',
      '--dm-text-sub': '#66795d',
      '--dm-accent': '#3d7a4e',
      '--dm-accent-soft': '#d7e8cf',
      '--dm-accent-contrast': '#ffffff',
      '--dm-danger': '#b8473f',
      '--dm-shadow': '0 1px 3px rgba(46, 64, 38, 0.1), 0 4px 14px rgba(46, 64, 38, 0.08)'
    }
  }
}

const state = reactive({
  current: localStorage.getItem('dm-theme') || 'light'
})

export function useTheme() {
  function apply(name) {
    const theme = themes[name]
    if (!theme) return
    state.current = name
    localStorage.setItem('dm-theme', name)
    const root = document.documentElement
    for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v)
  }

  watch(
    () => state.current,
    (name) => apply(name),
    { immediate: true }
  )

  return { state, themes, apply }
}

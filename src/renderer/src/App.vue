<!--
@Time    : 2026/10/19 15:00
@Author  : fzf
@FileName: App.vue
@Software: deepin-desktop-manager
-->
<template>
  <n-config-provider :theme="configTheme" :theme-overrides="configOverrides">
  <div class="dm-layout">
    <!-- 顶部菜单条（应用标题 + 内联语言/主题快捷切换，与原生菜单并存） -->
    <header class="dm-topbar">
      <div class="dm-topbar-title">🗂️ {{ t('appTitle') }}</div>
      <div class="dm-topbar-actions">
        <n-dropdown :options="localeOptions" @select="switchLocale">
          <n-button quaternary size="small">{{ state.locale === 'zh-CN' ? '中文' : 'English' }} ▾</n-button>
        </n-dropdown>
        <n-dropdown :options="themeOptions" @select="applyTheme">
          <n-button quaternary size="small">🎨 {{ themeLabel }} ▾</n-button>
        </n-dropdown>
      </div>
    </header>

    <!-- 侧栏：搜索 + 列表 -->
    <aside class="dm-sidebar">
      <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px">
        <n-auto-complete
          v-model:value="keyword"
          :options="searchSuggestions"
          :placeholder="t('searchPlaceholder')"
          clearable
          blur-after-select
          @select="onSuggestionSelect"
        >
          <template #prefix>🔍</template>
        </n-auto-complete>
        <div style="display: flex; gap: 6px; align-items: center">
          <n-select v-model:value="sourceFilter" size="small" :options="sourceOptions" />
          <n-button size="small" type="primary" @click="openNew">{{ t('newItem') }}</n-button>
        </div>
        <n-select v-model:value="dirFilter" size="small" :options="dirOptions" :placeholder="t('filterLabel') + ' ~'" clearable />
        <div style="font-size: 12px; color: var(--dm-text-sub)">
          {{ t('totalItems', { n: filtered.length }) }}
          <span v-if="overrideCount"> · {{ t('overrides', { n: overrideCount }) }}</span>
        </div>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 0 8px 12px">
        <div
          v-for="item in filtered"
          :key="item.id"
          class="dm-item"
          :class="{ active: selected?.id === item.id }"
          @click="select(item)"
        >
          <img v-if="iconUrls[item.id]" :src="iconUrls[item.id]" @error="iconUrls[item.id] = null" />
          <span v-else class="dm-icon-fallback">{{ (item.name || '?').slice(0, 1).toUpperCase() }}</span>
          <div style="flex: 1; min-width: 0">
            <div class="dm-item-title">{{ item.nameLocalized || item.name }}</div>
            <div class="dm-item-sub">{{ item.exec || item.fileName }}</div>
          </div>
          <span class="dm-badge" :class="badgeClass(item)">{{ badgeText(item) }}</span>
        </div>
        <div v-if="!filtered.length && !loading" class="dm-empty" style="height: 200px">
          <span>📭</span><span>{{ t('noMatch') }}</span>
        </div>
      </div>
    </aside>

    <!-- 主区：详情 / 编辑 -->
    <main class="dm-main">
      <div v-if="mode === 'view' && selected" class="dm-card">
        <h2>
          <img v-if="iconUrls[selected.id]" :src="iconUrls[selected.id]" />
          <span v-else class="dm-icon-fallback" style="width: 40px; height: 40px; font-size: 18px">
            {{ (selected.name || '?').slice(0, 1).toUpperCase() }}
          </span>
          {{ selected.nameLocalized || selected.name }}
          <span class="dm-badge" :class="badgeClass(selected)">{{ badgeText(selected) }}</span>
        </h2>
        <div class="dm-meta">
          {{ selected.dirPath }}/{{ selected.fileName }}
          <span v-if="selected.parseErrors.length" style="color: var(--dm-danger)">
            · {{ t('parsingErrors', { n: selected.parseErrors.length }) }}
          </span>
        </div>

        <div class="dm-form-row" v-for="row in viewRows" :key="row[0]">
          <label>{{ row[0] }}</label>
          <div style="padding-top: 6px; word-break: break-all">{{ row[1] || '—' }}</div>
        </div>

        <div class="dm-actions">
          <n-button type="primary" :disabled="!selected.writable" @click="startEdit">
            {{ selected.writable ? t('btnEdit') : t('btnCopyAndEdit') }}
          </n-button>
          <n-button v-if="selected.writable" @click="startEditRaw">{{ t('btnViewSource') }}</n-button>
          <n-button v-else @click="copyToUser()">{{ t('btnCopyOnly') }}</n-button>
          <n-button :disabled="!selected.writable" type="error" secondary @click="confirmDelete">
            {{ t('btnDelete') }}
          </n-button>
          <n-button quaternary @click="showInFolder">{{ t('btnShowInFolder') }}</n-button>
        </div>
      </div>

      <!-- 编辑模式 -->
      <div v-if="mode === 'edit' && selected" class="dm-card">
        <h2>{{ t('editTitle') }} — {{ selected.fileName }}</h2>
        <div class="dm-meta">{{ editTarget }}</div>
        <div class="dm-form-row">
          <label>{{ t('fieldNameLabel') }}</label>
          <input v-model="editForm.Name" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldExec') }}</label>
          <input v-model="editForm.Exec" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldIcon') }}</label>
          <input v-model="editForm.Icon" :placeholder="t('iconPlaceholder')" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldComment') }}</label>
          <input v-model="editForm.Comment" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldCategories') }}</label>
          <input v-model="editForm.Categories" :placeholder="t('categoriesPlaceholder')" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldTerminal') }}</label>
          <n-switch v-model:value="editForm.Terminal" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldNoDisplay') }}</label>
          <n-switch v-model:value="editForm.NoDisplay" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldRaw') }}</label>
          <textarea v-model="rawContent" spellcheck="false"></textarea>
        </div>
        <div class="dm-actions">
          <n-button type="primary" :loading="saving" @click="save(true)">{{ t('btnFormSave') }}</n-button>
          <n-button :loading="saving" @click="save(false)">{{ t('btnRawSave') }}</n-button>
          <n-button quaternary @click="cancelEdit">{{ t('btnCancel') }}</n-button>
        </div>
      </div>

      <!-- 新建模式 -->
      <div v-if="mode === 'new'" class="dm-card">
        <h2>{{ t('newTitle') }}</h2>
        <div class="dm-meta">{{ t('newHint') }}</div>
        <div class="dm-form-row">
          <label>{{ t('fieldName') }}</label>
          <input v-model="newForm.fileName" :placeholder="t('fieldNamePh')" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldNameLabel') }}</label>
          <input v-model="newForm.name" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldExec') }}</label>
          <input v-model="newForm.exec" :placeholder="t('execPlaceholder')" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldIcon') }}</label>
          <input v-model="newForm.icon" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldComment') }}</label>
          <input v-model="newForm.comment" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldCategories') }}</label>
          <input v-model="newForm.categories" :placeholder="t('categoriesNewPlaceholder')" />
        </div>
        <div class="dm-form-row">
          <label>{{ t('fieldTerminal') }}</label>
          <n-switch v-model:value="newForm.terminal" />
        </div>
        <div class="dm-actions">
          <n-button type="primary" :loading="saving" @click="createNew">{{ t('btnCreate') }}</n-button>
          <n-button quaternary @click="cancelNew">{{ t('btnCancel') }}</n-button>
        </div>
      </div>

      <div v-if="mode === 'view' && !selected" class="dm-empty">
        <span style="font-size: 40px">🗂️</span>
        <span>{{ loading ? t('scanning') : t('pickOne') }}</span>
      </div>
    </main>

    <!-- 关于：应用内模态卡片 -->
    <div v-if="showAbout" class="dm-modal-mask" @click.self="showAbout = false">
      <div class="dm-modal">
        <img src="/icon.svg" style="width: 64px; height: 64px" alt="icon" />
        <h2 style="margin: 8px 0 0; font-size: 17px">{{ t('appTitle') }}</h2>
        <div style="color: var(--dm-text-sub); font-size: 12px; margin: 2px 0 12px">
          {{ t('aboutVersion') }} 0.1.0
        </div>
        <div class="dm-modal-row"><span>{{ t('aboutAuthor') }}</span><b>fzf</b></div>
        <div class="dm-modal-row"><span>{{ t('labelType') }}</span><b>Deepin / Linux Desktop</b></div>
        <div class="dm-modal-row"><span>{{ t('aboutTech') }}</span></div>
        <n-button type="primary" block style="margin-top: 14px" @click="showAbout = false">
          {{ t('aboutClose') }}
        </n-button>
      </div>
    </div>
  </div>
  </n-config-provider>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive } from 'vue'
import { NButton, NAutoComplete, NSwitch, NSelect, NDropdown, NConfigProvider, createDiscreteApi, darkTheme, lightTheme } from 'naive-ui'
import { useI18n } from './i18n.js'
import { useTheme, themes } from './theme.js'

const { t, state: i18nState, setLocale } = useI18n()
const { state: themeState, apply: applyTheme } = useTheme()

const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: computed(() => {
    const name = themeState.current
    const isDark = name === 'dark'
    // 主题色随主题联动：浅蓝/亮蓝/森绿
    const primary = themes[name]?.naivePrimary || '#2563eb'
    const overrides = {
      common: {
        primary,
        primaryHover: primary,
        primaryPressed: primary,
        primarySuppl: primary
      }
    }
    return { theme: isDark ? darkTheme : lightTheme, themeOverrides: overrides }
  })
})

// naive-ui 组件主题：按当前主题联动暗色与主色
const configTheme = computed(() => (themeState.current === 'dark' ? darkTheme : lightTheme))
const configOverrides = computed(() => {
  const primary = themes[themeState.current]?.naivePrimary || '#2563eb'
  return { common: { primary, primaryHover: primary, primaryPressed: primary, primarySuppl: primary } }
})

const entries = ref([])
const overridden = ref([])
const dirs = ref([])
const loading = ref(true)
const selected = ref(null)
const mode = ref('view') // view | edit | new
const keyword = ref('')
const dirFilter = ref(null)
const sourceFilter = ref('user') // user | system | all，默认只看用户可编辑项
const showAbout = ref(false)
const saving = ref(false)
const rawContent = ref('')
const editForm = reactive({ Name: '', Exec: '', Icon: '', Comment: '', Categories: '', Terminal: false, NoDisplay: false })
const newForm = reactive({ fileName: '', name: '', exec: '', icon: '', comment: '', categories: 'Utility;', terminal: false })
const iconUrls = reactive({})
const editTarget = ref('')

// ---------- 语言 / 主题 ----------

const localeOptions = [
  { label: '中文', key: 'zh-CN' },
  { label: 'English', key: 'en-US' }
]

const themeOptions = computed(() => Object.entries(themes).map(([key, v]) => ({ label: v.label, key })))
const themeLabel = computed(() => themes[themeState.current]?.label || '')

function switchLocale(locale) {
  setLocale(locale)
  window.api.setLocale(locale)
}

// ---------- 原生菜单事件 ----------

let offMenu = null

function handleMenu({ action, value }) {
  if (action === 'new') openNew()
  else if (action === 'refresh') load()
  else if (action === 'save' && mode.value === 'edit') save(true)
  else if (action === 'delete' && mode.value === 'view' && selected.value) confirmDelete()
  else if (action === 'theme') applyTheme(value)
  else if (action === 'locale') switchLocale(value)
  else if (action === 'about') showAbout.value = true
}

// ---------- 数据逻辑 ----------

const dirOptions = computed(() =>
  dirs.value.map((d) => ({ label: d.path.replace(/^\/home\/[^/]+/, '~'), value: d.path }))
)

const sourceOptions = computed(() => [
  { label: t('filterUser'), value: 'user' },
  { label: t('filterSystem'), value: 'system' },
  { label: t('filterAll'), value: 'all' }
])

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return entries.value.filter((e) => {
    if (sourceFilter.value === 'user' && !e.writable) return false
    if (sourceFilter.value === 'system' && e.writable) return false
    if (dirFilter.value && e.dirPath !== dirFilter.value) return false
    if (!kw) return true
    return [e.name, e.nameLocalized, e.exec, e.fileName].some((s) => s?.toLowerCase().includes(kw))
  })
})

const overrideCount = computed(() => overridden.value.length)

// 快捷搜索下拉：按显示名/文件名出建议，label 带图标占位
const searchSuggestions = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return []
  return entries.value
    .filter((e) => [e.name, e.nameLocalized, e.fileName].some((s) => s?.toLowerCase().includes(kw)))
    .slice(0, 10)
    .map((e) => ({ label: `${e.nameLocalized || e.name}（${e.fileName}）`, value: e.fileName }))
})

function onSuggestionSelect(fileName) {
  const hit = entries.value.find((e) => e.fileName === fileName)
  if (hit) select(hit)
}

const viewRows = computed(() => {
  if (!selected.value) return []
  const s = selected.value
  const typeText = s.type === 'Application' ? t('typeApp') : s.type === 'Link' ? t('typeLink') : s.type === 'Directory' ? t('typeDir') : s.type
  return [
    [t('labelName'), s.nameLocalized || s.name],
    [t('labelExec'), s.exec],
    [t('labelIcon'), s.icon],
    [t('labelComment'), s.comment],
    [t('labelCategories'), s.categories.join('; ') || '—'],
    [t('labelType'), typeText],
    [t('fieldTerminal'), s.terminal ? '✓' : '✗'],
    [t('fieldNoDisplay'), s.noDisplay ? t('hiddenInLauncher') : '✗']
  ]
})

function badgeClass(item) {
  if (overridden.value.some((o) => o.overridden === item.dirPath && o.name === item.fileName)) return 'override'
  return item.writable ? 'user' : 'sys'
}

function badgeText(item) {
  if (overridden.value.some((o) => o.overridden === item.dirPath && o.name === item.fileName))
    return t('badgeOverridden')
  return item.writable ? t('badgeUser') : t('badgeSystem')
}

async function load(keepSelection = true) {
  loading.value = true
  const res = await window.api.scan()
  loading.value = false
  if (!res.ok) {
    message.error(t('scanFailed'))
    return
  }
  entries.value = res.data.entries
  overridden.value = res.data.overridden
  dirs.value = res.data.dirs
  // 实时刷新：重扫后按路径找回选中项，详情随之更新；原项已删除则清空
  if (keepSelection && selected.value) {
    const again = entries.value.find((e) => e.id === selected.value.id)
    selected.value = again || null
    if (!again) mode.value = 'view'
  } else if (!selected.value && entries.value.length) {
    select(entries.value[0])
  }
}

function select(item) {
  mode.value = 'view'
  selected.value = item
}

function cancelEdit() {
  mode.value = 'view'
}

function cancelNew() {
  mode.value = 'view'
  if (!selected.value) loadFirst()
}

function loadFirst() {
  if (entries.value.length) select(entries.value[0])
}

// 图标解析：渲染进程给出候选路径，主进程探测后回传可用 URL
function resolveIcon(item) {
  const icon = item.icon
  if (!icon) return
  if (icon.startsWith('/')) {
    iconUrls[item.id] = `file://${icon}`
    return
  }
  const candidates = [
    `/usr/share/icons/hicolor/scalable/apps/${icon}.svg`,
    `/usr/share/icons/hicolor/128x128/apps/${icon}.png`,
    `/usr/share/icons/hicolor/64x64/apps/${icon}.png`,
    `/usr/share/icons/hicolor/48x48/apps/${icon}.png`,
    `/usr/share/pixmaps/${icon}.png`,
    `/usr/share/icons/bloom/scalable/apps/${icon}.svg`,
    `/usr/share/icons/bloom/128x128/apps/${icon}.png`
  ]
  window.api.resolveIcon(candidates).then((url) => {
    if (url) iconUrls[item.id] = url
  })
}

function startEdit() {
  const s = selected.value
  if (!s.writable) {
    copyToUser()
    return
  }
  window.api.readRaw(s.id).then((res) => {
    if (!res.ok) {
      message.error(res.error)
      return
    }
    rawContent.value = res.data
    Object.assign(editForm, {
      Name: s.name,
      Exec: s.exec,
      Icon: s.icon,
      Comment: s.comment,
      Categories: s.categories.join(';') + (s.categories.length ? ';' : ''),
      Terminal: s.terminal,
      NoDisplay: s.noDisplay
    })
    editTarget.value = s.id
    mode.value = 'edit'
    resolveIcon(s)
  })
}

// 只进源码编辑（复用已加载的表单状态，不动表单值）
function startEditRaw() {
  startEdit()
}

async function save(byForm) {
  saving.value = true
  try {
    if (byForm) {
      // 表单保存：行级补丁只改表单字段，避免解析→重组丢内容或遇异常文件崩溃
      const updates = {
        Name: editForm.Name,
        Exec: editForm.Exec,
        Icon: editForm.Icon,
        Comment: editForm.Comment,
        Categories: editForm.Categories,
        Terminal: editForm.Terminal ? 'true' : 'false',
        NoDisplay: editForm.NoDisplay ? 'true' : 'false'
      }
      const res = await window.api.patch({ filePath: editTarget.value, updates })
      if (!res.ok) throw new Error(res.error)
      message.success(t('saved', { backup: res.data.backupPath ? t('backedUp') : '' }))
      mode.value = 'view'
      await load()
      return
    }
    const parsed = parseDesktopContent(rawContent.value)
    if (parsed.parseErrors.length) {
      message.warning(t('rawWarning', { n: parsed.parseErrors.length }))
    }
    const res = await window.api.save({ filePath: editTarget.value, groups: rawToGroups(rawContent.value) })
    if (!res.ok) throw new Error(res.error)
    message.success(t('saved', { backup: res.data.backupPath ? t('backedUp') : '' }))
    mode.value = 'view'
    await load()
  } catch (err) {
    message.error(err.message)
  } finally {
    saving.value = false
  }
}

// 简易源码 → groups 转换（与主进程 parser 行为一致的子集）
function parseDesktopContent(content) {
  const groups = []
  const parseErrors = []
  let cur = null
  content.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const g = line.match(/^\[(.+)\]$/)
    if (g) {
      cur = { groupName: g[1], fields: [] }
      groups.push(cur)
      return
    }
    const kv = line.match(/^([A-Za-z0-9][A-Za-z0-9_.[\]-]*)\s*=\s*([\s\S]*)$/)
    if (kv && cur) {
      cur.fields.push([kv[1], kv[2]])
    } else {
      parseErrors.push(`第 ${i + 1} 行`)
    }
  })
  return { groups, parseErrors }
}

function rawToGroups(content) {
  return parseDesktopContent(content).groups
}

async function copyToUser() {
  const s = selected.value
  const res = await window.api.readRaw(s.id)
  if (!res.ok) {
    message.error(res.error)
    return
  }
  const target = await window.api.copyToUser({ fileName: s.fileName, content: res.data })
  if (!target.ok) {
    message.error(t('copyFailed'))
    return
  }
  message.success(t('copied', { path: target.data }))
  await load()
  const copied = entries.value.find((e) => e.id === target.data)
  if (copied) {
    select(copied)
    startEdit()
  }
}

function confirmDelete() {
  const s = selected.value
  dialog.warning({
    title: t('deleteConfirmTitle'),
    content: t('deleteConfirmBody', { name: s.fileName }),
    positiveText: t('deleteOk'),
    negativeText: t('cancel'),
    onPositiveClick: async () => {
      const res = await window.api.remove(s.id)
      if (!res.ok) {
        message.error(t('deleteFailed'))
        return
      }
      message.success(t('deleted', { backup: res.data.backupPath ? t('backedUp') : '' }))
      selected.value = null
      mode.value = 'view'
      await load()
    }
  })
}

function openNew() {
  mode.value = 'new'
}

async function createNew() {
  const f = newForm
  if (!f.fileName.trim() || !f.name.trim() || !f.exec.trim()) {
    message.error(t('requiredFields'))
    return
  }
  saving.value = true
  try {
    const tpl = await window.api.template({ ...f })
    if (!tpl.ok) throw new Error(tpl.error)
    const res = await window.api.save({ filePath: tpl.data.filePath, groups: rawToGroups(tpl.data.content) })
    if (!res.ok) throw new Error(res.error)
    message.success(t('created'))
    mode.value = 'view'
    await load(false) // 新建后全量刷新并选中新文件
    const created = entries.value.find((e) => e.id === tpl.data.filePath)
    if (created) select(created)
  } catch (err) {
    message.error(err.message)
  } finally {
    saving.value = false
  }
}

async function showInFolder() {
  await window.api.showInFolder(selected.value.id)
}

onMounted(() => {
  load()
  offMenu = window.api.onMenu(handleMenu)
  // 菜单语言与渲染进程持久化的语言对齐
  window.api.setLocale(i18nState.locale)
})

onBeforeUnmount(() => {
  if (offMenu) offMenu()
})
</script>

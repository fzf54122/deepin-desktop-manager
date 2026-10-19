// @Time    : 2026/10/19 15:25
// @Author  : fzf
// @FileName: main.js
// @Software: Claude Code

// 中英双语切换 + 复制按钮，浅色科技风单页，无框架依赖

const I18N = {
  zh: {
    navFeatures: '功能',
    navScreenshots: '截图',
    navInstall: '安装',
    heroKicker: '为 Deepin / Linux 桌面打造',
    heroTitle: '管理 .desktop 文件，<br />从未如此<em>从容</em>',
    heroSub: '扫描、编辑、新建、备份——以 XDG union 语义统一管理应用启动项，系统文件只读保护，更改随时可回退。',
    heroCta: '下载 deb',
    heroGithub: '查看源码',
    chipDeepin: '兼容 deepin 20.9+',
    tagUser: '用户',
    tagSystem: '系统',
    tagSystem2: '系统',
    tagModified: '已修改',
    featuresTitle: '功能',
    featuresLead: '围绕 .desktop 文件全生命周期的一组克制而完整的能力。',
    f1Title: '多路径扫描',
    f1Desc: '扫描用户目录、系统目录与 flatpak 导出目录，遵循 XDG union 语义，自动标注覆盖关系。',
    f2Title: '双视图编辑',
    f2Desc: '表单编辑常用字段，源码视图直改原文；未识别字段（本地化 Name、Desktop Actions）原样保留。',
    f3Title: '模板新建',
    f3Desc: '模板向导生成新启动项，固定写入用户目录，不污染系统配置。',
    f4Title: '删除即备份',
    f4Desc: '删除前自动备份到 ~/.local/share/desktop-manager/backup/，随时可手动恢复。',
    f5Title: '系统文件只读',
    f5Desc: '/usr/share 下的文件不直接改写，引导复制到用户目录做 union 覆盖，避免提权风险。',
    f6Title: '原子写入',
    f6Desc: '主进程统一文件 IO，原子写入 + 备份，渲染进程经 contextBridge 通信，contextIsolation 全程开启。',
    shotsTitle: '一屏速览',
    shotsLead: '窗口示意图，实际以应用为准。',
    installTitle: '安装',
    installLead: '从 GitHub Releases 下载 deb 包，一条命令完成安装。',
    copy: '复制',
    copy2: '复制',
    copied: '已复制',
    installNote: '运行时依赖 libnotify4；deb 包已声明。',
    installBtn: '前往 Releases 下载',
    footer: 'deepin-desktop-manager · MIT License',
  },
  en: {
    navFeatures: 'Features',
    navScreenshots: 'Overview',
    navInstall: 'Install',
    heroKicker: 'Built for Deepin / Linux desktops',
    heroTitle: 'Manage .desktop files,<br />without the <em>pain</em>',
    heroSub: 'Scan, edit, create and back up app launchers with XDG union semantics. System files stay read-only; every change is reversible.',
    heroCta: 'Download deb',
    heroGithub: 'View source',
    chipDeepin: 'deepin 20.9+ ready',
    tagUser: 'USER',
    tagSystem: 'SYSTEM',
    tagSystem2: 'SYSTEM',
    tagModified: 'MODIFIED',
    featuresTitle: 'Features',
    featuresLead: 'A focused, complete toolkit for the whole life cycle of .desktop files.',
    f1Title: 'Multi-path scanning',
    f1Desc: 'Scans user, system and flatpak export directories with XDG union semantics, marking overrides automatically.',
    f2Title: 'Dual-view editing',
    f2Desc: 'Edit common fields in a form or the raw source directly. Unrecognized fields (localized Name, Desktop Actions) are preserved.',
    f3Title: 'Template-based creation',
    f3Desc: 'A guided wizard creates new launchers in the user directory only — system config stays untouched.',
    f4Title: 'Backup on delete',
    f4Desc: 'Deleted files are backed up to ~/.local/share/desktop-manager/backup/ for manual restore anytime.',
    f5Title: 'System files read-only',
    f5Desc: 'Files under /usr/share are never written directly. Copy to the user directory for a union override instead — no privilege escalation.',
    f6Title: 'Atomic writes',
    f6Desc: 'All file IO lives in the main process with atomic writes + backups. The renderer talks through contextBridge with contextIsolation always on.',
    shotsTitle: 'At a glance',
    shotsLead: 'A stylized window mockup; the real app may differ.',
    installTitle: 'Install',
    installLead: 'Grab the deb from GitHub Releases and install with one command.',
    copy: 'Copy',
    copy2: 'Copy',
    copied: 'Copied',
    installNote: 'Runtime dependency: libnotify4 (already declared in the deb).',
    installBtn: 'Download from Releases',
    footer: 'deepin-desktop-manager · MIT License',
  },
}

const htmlEl = document.documentElement
const langBtn = document.getElementById('langBtn')

function applyLang(lang) {
  htmlEl.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.title = lang === 'zh'
    ? 'deepin-desktop-manager — 桌面 .desktop 文件管理器'
    : 'deepin-desktop-manager — Manage .desktop files with ease'
  langBtn.textContent = lang === 'zh' ? 'EN' : '中'

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n
    if (I18N[lang][key] !== undefined) {
      el.textContent = I18N[lang][key]
    }
  })

  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.dataset.i18nHtml
    if (I18N[lang][key] !== undefined) {
      el.innerHTML = I18N[lang][key]
    }
  })
}

function readLang() {
  // 优先用户上次选择，否则跟随浏览器语言
  const stored = localStorage.getItem('ddm-lang')
  if (stored === 'zh' || stored === 'en') {
    return stored
  }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

let currentLang = readLang()
applyLang(currentLang)

langBtn.addEventListener('click', () => {
  currentLang = currentLang === 'zh' ? 'en' : 'zh'
  localStorage.setItem('ddm-lang', currentLang)
  applyLang(currentLang)
})

// 复制按钮
document.querySelectorAll('.copy-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy)
      const original = btn.textContent
      btn.textContent = I18N[currentLang].copied
      btn.classList.add('copied')
      window.setTimeout(() => {
        btn.textContent = original
        btn.classList.remove('copied')
      }, 1400)
    } catch {
      // 剪贴板不可用（非安全上下文等）时静默忽略，不打断浏览
    }
  })
})

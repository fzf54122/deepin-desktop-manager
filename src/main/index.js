// @Time    : 2026/10/19 14:45
// @Author  : fzf
// @FileName: index.js
// @Software: deepin-desktop-manager

import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron'
import { join } from 'path'
import { accessSync, constants } from 'fs'
import { scanAll, defaultScanDirs } from './scanner.js'
import { saveDesktopFile, deleteDesktopFile, buildTemplate, backupDir, atomicWrite, patchDesktopEntry } from './editor.js'
import { readFile, copyFile, mkdir } from 'fs/promises'
import { homedir } from 'os'

// Linux 下窗口管理器不总能从 .desktop 反查图标,显式指定避免任务栏/pin 后显示默认图标
const APP_ICON = join(__dirname, '../../build/icons/512x512.png')

// 深浅主题下窗口背景色，避免启动闪白/闪黑
const WINDOW_BG = { light: '#f5f7fa', dark: '#111827', green: '#eef3ea' }

// deepin 老内核 GPU 兼容：GPU 进程反复崩溃时走软件渲染，用户可传 --enable-gpu 显式开启硬件加速
if (!process.argv.includes('--enable-gpu')) {
  app.commandLine.appendSwitch('disable-gpu')
}

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 860,
    minHeight: 600,
    title: 'Desktop Manager',
    icon: APP_ICON,
    backgroundColor: WINDOW_BG[process.env.DM_THEME] || WINDOW_BG.light,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 开发模式加载 dev-server，生产加载打包文件
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const initialLocale = app.getLocale().toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN'
  buildAppMenu(initialLocale)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ---------- 原生应用菜单（双语文案，随渲染进程语言切换重建） ----------

const MENU_I18N = {
  'zh-CN': {
    file: '文件', edit: '编辑', view: '视图', help: '帮助',
    new: '新建 Desktop 文件', refresh: '刷新列表', openBackup: '打开备份目录', quit: '退出',
    save: '保存', del: '删除当前项',
    theme: '主题', themeLight: '浅色', themeDark: '深色', themeGreen: '护眼绿',
    lang: '语言 Language', langZh: '中文', langEn: 'English',
    about: '关于'
  },
  'en-US': {
    file: 'File', edit: 'Edit', view: 'View', help: 'Help',
    new: 'New Desktop File', refresh: 'Refresh', openBackup: 'Open Backup Directory', quit: 'Quit',
    save: 'Save', del: 'Delete Current',
    theme: 'Theme', themeLight: 'Light', themeDark: 'Dark', themeGreen: 'Eye Care',
    lang: '语言 Language', langZh: '中文', langEn: 'English',
    about: 'About'
  }
}

function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args)
}

function buildAppMenu(locale) {
  const m = MENU_I18N[locale] || MENU_I18N['zh-CN']
  const template = [
    {
      label: m.file,
      submenu: [
        { label: m.new, click: () => sendToRenderer('menu', { action: 'new' }) },
        { label: m.refresh, accelerator: 'CmdOrCtrl+R', click: () => sendToRenderer('menu', { action: 'refresh' }) },
        { type: 'separator' },
        { label: m.openBackup, click: () => shell.openPath(backupDir()) },
        { type: 'separator' },
        { label: m.quit, role: 'quit' }
      ]
    },
    {
      label: m.edit,
      submenu: [
        { label: m.save, accelerator: 'CmdOrCtrl+S', click: () => sendToRenderer('menu', { action: 'save' }) },
        { label: m.del, click: () => sendToRenderer('menu', { action: 'delete' }) }
      ]
    },
    {
      label: m.view,
      submenu: [
        {
          label: m.theme,
          submenu: [
            { label: m.themeLight, click: () => sendToRenderer('menu', { action: 'theme', value: 'light' }) },
            { label: m.themeDark, click: () => sendToRenderer('menu', { action: 'theme', value: 'dark' }) },
            { label: m.themeGreen, click: () => sendToRenderer('menu', { action: 'theme', value: 'green' }) }
          ]
        },
        {
          label: m.lang,
          submenu: [
            { label: m.langZh, click: () => sendToRenderer('menu', { action: 'locale', value: 'zh-CN' }) },
            { label: m.langEn, click: () => sendToRenderer('menu', { action: 'locale', value: 'en-US' }) }
          ]
        }
      ]
    },
    {
      label: m.help,
      submenu: [
        {
          label: m.about,
          click: () => sendToRenderer('menu', { action: 'about' })
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// 渲染进程切换语言后重建菜单
ipcMain.handle('app:set-locale', (_e, locale) => {
  buildAppMenu(locale)
  return { ok: true }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---------- IPC 桥 ----------

// 扫描全部 desktop 文件
ipcMain.handle('desktop:scan', async () => {
  const { entries, overridden } = await scanAll()
  return { ok: true, data: { entries, overridden, dirs: defaultScanDirs() } }
})

// 读取文件原始内容（源码视图）
ipcMain.handle('desktop:read-raw', async (_e, filePath) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return { ok: true, data: content }
  } catch (err) {
    return { ok: false, error: `读取失败: ${err.message}` }
  }
})

// 表单保存：行级补丁，只改表单字段，其余内容原样保留
ipcMain.handle('desktop:patch', async (_e, { filePath, updates }) => {
  try {
    const raw = await readFile(filePath, 'utf-8')
    const patched = patchDesktopEntry(raw, updates)
    const { backupPath } = await saveDesktopFile(filePath, null, patched)
    return { ok: true, data: { backupPath } }
  } catch (err) {
    return { ok: false, error: `保存失败: ${err.message}` }
  }
})

// 保存（源码模式整文写入）
ipcMain.handle('desktop:save', async (_e, { filePath, groups }) => {
  try {
    const { backupPath } = await saveDesktopFile(filePath, groups)
    return { ok: true, data: { backupPath } }
  } catch (err) {
    return { ok: false, error: `保存失败: ${err.message}` }
  }
})

// 删除
ipcMain.handle('desktop:delete', async (_e, filePath) => {
  try {
    const { backupPath } = await deleteDesktopFile(filePath)
    return { ok: true, data: { backupPath } }
  } catch (err) {
    return { ok: false, error: `删除失败: ${err.message}` }
  }
})

// 新建模板生成
ipcMain.handle('desktop:template', async (_e, data) => {
  try {
    return { ok: true, data: buildTemplate(data) }
  } catch (err) {
    return { ok: false, error: `生成模板失败: ${err.message}` }
  }
})

// 打开备份目录
ipcMain.handle('desktop:open-backup-dir', async () => {
  await shell.openPath(backupDir())
  return { ok: true }
})

// 探测候选图标路径，返回第一个存在的 file:// URL
ipcMain.handle('desktop:resolve-icon', async (_e, candidates) => {
  for (const p of candidates) {
    try {
      accessSync(p, constants.R_OK)
      return `file://${p}`
    } catch {
      continue
    }
  }
  return null
})

// 把系统目录的 desktop 文件复制到用户目录（union 覆盖语义，用于编辑只读文件）
ipcMain.handle('desktop:copy-to-user', async (_e, { fileName, content }) => {
  try {
    const userAppsDir = join(homedir(), '.local/share/applications')
    const target = join(userAppsDir, fileName)
    await mkdir(userAppsDir, { recursive: true })
    // 若用户目录已有同名文件，先备份再覆盖
    let backupPath = null
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      backupPath = join(backupDir(), `${fileName}.${ts}.bak`)
      await mkdir(backupDir(), { recursive: true })
      await copyFile(target, backupPath)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    await atomicWrite(target, content)
    return { ok: true, data: target }
  } catch (err) {
    return { ok: false, error: `复制到用户目录失败: ${err.message}` }
  }
})

// 在文件管理器中显示文件
ipcMain.handle('desktop:show-in-folder', async (_e, filePath) => {
  shell.showItemInFolder(filePath)
  return { ok: true }
})

// 错误弹窗
ipcMain.handle('desktop:alert', async (_e, { title, message }) => {
  await dialog.showMessageBox(mainWindow, { type: 'error', title, message, buttons: ['确定'] })
  return { ok: true }
})

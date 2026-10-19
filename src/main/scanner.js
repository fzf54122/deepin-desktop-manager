// @Time    : 2026/10/19 14:35
// @Author  : fzf
// @FileName: scanner.js
// @Software: deepin-desktop-manager

import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { parseToGroups, getMainFields, localizedValue } from './parser.js'

/** 默认扫描目录（freedesktop 标准路径） */
export function defaultScanDirs() {
  const home = homedir()
  const xdgData = process.env.XDG_DATA_HOME || join(home, '.local/share')
  return [
    { path: join(home, '.local/share/applications'), writable: true },
    { path: join(home, '.local/share/flatpak/exports/share/applications'), writable: true },
    { path: '/usr/local/share/applications', writable: false },
    { path: '/usr/share/applications', writable: false },
    { path: '/var/lib/flatpak/exports/share/applications', writable: false }
  ]
}

/**
 * 扫描单个目录，返回其中的 desktop 文件条目
 * 单个目录读取失败（不存在/无权限）不中断整体扫描
 */
async function scanOneDir(dir, writable) {
  let names = []
  try {
    names = await readdir(dir)
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'EACCES') {
      // 目录无法读取时记录但继续，不影响其他目录
      console.error(`扫描目录失败 ${dir}: ${err.message}`)
    }
    return []
  }

  const entries = await Promise.all(
    names
      .filter((n) => n.endsWith('.desktop'))
      .map(async (name) => {
        const filePath = join(dir, name)
        try {
          const s = await stat(filePath)
          if (!s.isFile()) return null
          const content = await readFile(filePath, 'utf-8')
          const { groups, parseErrors } = parseToGroups(content)
          const fields = getMainFields(content)
          const mainGroup = groups.find((g) => g.groupName === 'Desktop Entry')
          return {
            id: filePath,
            fileName: name,
            dirPath: dir,
            writable,
            size: s.size,
            mtime: s.mtimeMs,
            name: fields.Name || name,
            nameLocalized: localizedValue(mainGroup?.fields || [], 'Name', process.env.LANG?.split('.')[0] || 'zh_CN'),
            exec: fields.Exec || '',
            icon: fields.Icon || '',
            categories: (fields.Categories || '').split(';').filter(Boolean),
            noDisplay: fields.NoDisplay === 'true',
            hidden: fields.Hidden === 'true',
            type: fields.Type || 'application',
            comment: fields.Comment || '',
            terminal: fields.Terminal === 'true',
            groups,
            parseErrors
          }
        } catch (err) {
          console.error(`读取失败 ${filePath}: ${err.message}`)
          return null
        }
      })
  )
  return entries.filter(Boolean)
}

/**
 * 扫描所有目录并处理覆盖关系
 * 同名文件：用户目录的会覆盖系统目录（桌面 union 语义）
 * @returns {Promise<{ entries: Array, overridden: Array<{ name: string, overrider: string, overridden: string }> }>}
 */
export async function scanAll(dirs = null) {
  const scanList = dirs || defaultScanDirs()
  // 按 union 优先级排序：列表顺序即优先级，先扫低优先级（系统目录），后扫高优先级（用户目录）
  const ordered = [...scanList].reverse()

  const byName = new Map()
  const overridden = []

  for (const { path, writable } of ordered) {
    const entries = await scanOneDir(path, writable)
    for (const entry of entries) {
      const existing = byName.get(entry.fileName)
      if (existing) {
        overridden.push({
          name: entry.fileName,
          overrider: entry.dirPath,
          overridden: existing.dirPath
        })
      }
      byName.set(entry.fileName, entry)
    }
  }

  // 还原为扫描目录定义顺序展示
  const dirOrder = new Map(scanList.map((d, i) => [d.path, i]))
  const entries = [...byName.values()].sort(
    (a, b) => (dirOrder.get(a.dirPath) ?? 99) - dirOrder.get(b.dirPath) || a.fileName.localeCompare(b.fileName)
  )

  return { entries, overridden }
}

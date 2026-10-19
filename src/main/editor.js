// @Time    : 2026/10/19 14:40
// @Author  : fzf
// @FileName: editor.js
// @Software: deepin-desktop-manager

import { readFile, writeFile, mkdir, copyFile, unlink, rename } from 'fs/promises'
import { dirname, join, basename } from 'path'
import { homedir } from 'os'
import { serializeGroups } from './parser.js'

/** 备份根目录 */
export function backupDir() {
  return join(homedir(), '.local/share/desktop-manager/backup')
}

/**
 * 写前备份：复制目标文件到备份目录（若已存在同名备份则追加时间戳）
 */
async function backupFile(filePath) {
  try {
    await readFile(filePath)
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const dest = join(backupDir(), `${basename(filePath)}.${ts}.bak`)
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(filePath, dest)
    return dest
  } catch (err) {
    if (err.code === 'ENOENT') return null // 新建文件无需备份
    throw err
  }
}

/**
 * 表单保存：行级补丁，只改 [Desktop Entry] 段内指定键的值。
 * 不做解析→重组，注释、空行、Desktop Actions、本地化键全部原样保留。
 * @param {string} raw 原始文件内容
 * @param {Record<string, string>} updates 键到新值的映射（值需已是字符串，布尔调用方转 true/false）
 * @returns {string} 补丁后的完整内容
 */
export function patchDesktopEntry(raw, updates) {
  // 去掉 BOM，写回时不带（部分编辑器写入 BOM 会让 [Desktop Entry] 组头匹配失败）
  const clean = raw.startsWith('﻿') ? raw.slice(1) : raw
  const lines = clean.split('\n')
  const pending = { ...updates }

  let inMain = false
  let mainStart = -1
  let insertAfter = -1 // 插入锚点：Entry 段内最后一个「非本地化已知键」之后，否则段头之后
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('[')) {
      if (inMain) break // 进入下一个组，主段结束
      if (trimmed === '[Desktop Entry]') {
        inMain = true
        mainStart = i
      }
      continue
    }
    if (!inMain || trimmed === '' || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Za-z0-9][A-Za-z0-9_.[\]-]*)\s*=/)
    if (!m) continue
    const key = m[1]
    if (key in pending) {
      lines[i] = `${key}=${pending[key]}`
      delete pending[key]
    }
    // 本地化键（含 []）与 Known 字段都可作为插入锚点
    if (insertAfter < i && !key.includes('[')) insertAfter = i
  }

  // 剩余未命中的键：插入到主段
  const rest = Object.entries(pending)
  if (rest.length) {
    if (mainStart < 0) {
      // 没有主组：文件头补一个
      lines.unshift('[Desktop Entry]', ...rest.map(([k, v]) => `${k}=${v}`))
    } else {
      const at = insertAfter > mainStart ? insertAfter : mainStart
      lines.splice(at + 1, 0, ...rest.map(([k, v]) => `${k}=${v}`))
    }
  }
  return lines.join('\n')
}

/**
 * 原子写入：先写临时文件再 rename，避免写一半损坏原文件
 */
export async function atomicWrite(filePath, content) {
  await mkdir(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp-${process.pid}`
  await writeFile(tmp, content, 'utf-8')
  await rename(tmp, filePath)
}

/**
 * 保存 desktop 文件
 * @param {string} filePath 目标绝对路径
 * @param {Array<{ groupName: string, fields: Array<[string, string]> }>|null} groups 结构化内容；传 null 时直接写 content
 * @param {string} [content] groups 为 null 时使用的完整文本内容
 * @returns {{ backupPath: string | null }}
 */
export async function saveDesktopFile(filePath, groups, content = null) {
  if (!filePath.endsWith('.desktop')) {
    throw new Error(`目标文件必须是 .desktop 结尾: ${filePath}`)
  }
  const backupPath = await backupFile(filePath)
  await atomicWrite(filePath, groups ? serializeGroups(groups) : content)
  return { backupPath }
}

/**
 * 删除 desktop 文件，删除前备份
 * @returns {{ backupPath: string | null }}
 */
export async function deleteDesktopFile(filePath) {
  const backupPath = await backupFile(filePath)
  await unlink(filePath)
  return { backupPath }
}

/**
 * 生成模板内容（新建向导用），统一保存到用户应用目录
 * @param {{ name: string, exec: string, icon: string, comment: string, categories: string, terminal: boolean, fileName: string }} data
 * @returns {{ fileName: string, filePath: string, content: string }}
 */
export function buildTemplate(data) {
  const appName = data.fileName.replace(/\.desktop$/, '') || 'new-app'
  const fileName = `${appName}.desktop`
  const filePath = join(homedir(), '.local/share/applications', fileName)
  const lines = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${data.name}`,
    `Exec=${data.exec}`
  ]
  if (data.icon) lines.push(`Icon=${data.icon}`)
  if (data.comment) lines.push(`Comment=${data.comment}`)
  if (data.categories) lines.push(`Categories=${data.categories}`)
  lines.push(`Terminal=${data.terminal ? 'true' : 'false'}`)
  lines.push('StartupNotify=false')
  return { fileName, filePath, content: lines.join('\n') + '\n' }
}

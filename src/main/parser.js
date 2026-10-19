// @Time    : 2026/10/19 14:30
// @Author  : fzf
// @FileName: parser.js
// @Software: deepin-desktop-manager

/**
 * .desktop 文件解析器（INI 格式的 freedesktop.org Desktop Entry 规范子集）
 * 只处理 [Desktop Entry] 组和 [Desktop Action xxx] 组
 */

/**
 * 解析 desktop 文件内容
 * @param {string} content 文件内容
 * @returns {{ groups: Array<{ name: string, entries: Array<[string, string]> }>, parseErrors: string[] }}
 */
export function parseDesktopFile(content) {
  const groups = []
  const parseErrors = []
  let current = null

  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()

    // 空行与注释
    if (line === '' || line.startsWith('#')) continue

    // 组头，如 [Desktop Entry] / [Desktop Action NewWindow]
    const groupMatch = line.match(/^\[(.+)\]$/)
    if (groupMatch) {
      current = { name: groupMatch[1], entries: [] }
      groups.push(current)
      continue
    }

    // 键值对，_first= 是本地化键如 Name[zh_CN]
    const kv = line.match(/^([A-Za-z0-9][A-Za-z0-9_.\[\]-]*)\s*=\s*([\s\S]*)$/)
    if (kv && current) {
      current.entries.push([kv[1], kv[2]])
      continue
    }

    parseErrors.push(`第 ${i + 1} 行无法解析: ${raw.slice(0, 80)}`)
  }

  return { groups, parseErrors }
}

/**
 * 解析为便于操作的结构
 * @typedef {Object} DesktopEntry
 * @property {string} groupName
 * @property {Map<string, string>} fields 有序键值（含本地化键）
 */
export function parseToGroups(content) {
  const { groups, parseErrors } = parseDesktopFile(content)
  return {
    groups: groups.map((g) => ({
      groupName: g.name,
      // 用数组保序，写回时不需要排序
      fields: g.entries
    })),
    parseErrors
  }
}

/**
 * 序列化回 desktop 文件内容
 * @param {Array<{ groupName: string, fields: Array<[string, string]> }>} groups
 * @returns {string}
 */
export function serializeGroups(groups) {
  return (
    groups
      .map((g) => `[${g.groupName}]\n${g.fields.map(([k, v]) => `${k}=${v}`).join('\n')}`)
      .join('\n\n') + '\n'
  )
}

/**
 * 提取主组字段为对象（取第一个值，输出展示用）
 * @returns {Record<string, string>}
 */
export function getMainFields(content) {
  const { groups } = parseDesktopFile(content)
  const main = groups.find((g) => g.name === 'Desktop Entry')
  if (!main) return {}
  const out = {}
  for (const [k, v] of main.entries) {
    if (!(k in out)) out[k] = v
  }
  return out
}

/**
 * 取本地化字段值，如 Name[zh_CN]，无则回退到 Name
 */
export function localizedValue(fields, baseKey, locale) {
  const map = new Map(fields)
  return map.get(`${baseKey}[${locale}]`) ?? map.get(baseKey) ?? ''
}

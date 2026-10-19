// @Time    : 2026/10/19 15:10
// @Author  : fzf
// @FileName: parser.test.js
// @Software: deepin-desktop-manager

import { describe, it, expect } from 'vitest'
import { parseToGroups, serializeGroups, getMainFields, localizedValue } from '../src/main/parser.js'

const SAMPLE = `# 注释行
[Desktop Entry]
Type=Application
Name=Firefox
Name[zh_CN]=火狐浏览器
Exec=/usr/lib/firefox/firefox %u
Icon=firefox
Categories=Network;WebBrowser;
Terminal=false
NoDisplay=false

[Desktop Action NewWindow]
Name=New Window
Exec=firefox --new-window %u`

describe('parseToGroups', () => {
  it('解析组与键值对并保持顺序', () => {
    const { groups, parseErrors } = parseToGroups(SAMPLE)
    expect(groups).toHaveLength(2)
    expect(groups[0].groupName).toBe('Desktop Entry')
    expect(groups[0].fields[0]).toEqual(['Type', 'Application'])
    expect(groups[1].groupName).toBe('Desktop Action NewWindow')
    expect(parseErrors).toHaveLength(0)
  })

  it('保留空值字段与本地化键', () => {
    const { groups } = parseToGroups(SAMPLE)
    const fields = groups[0].fields
    expect(fields.find(([k]) => k === 'Name[zh_CN]')[1]).toBe('火狐浏览器')
    const empty = parseToGroups('[Desktop Entry]\nEmpty=\n').groups
    expect(empty[0].fields).toContainEqual(['Empty', ''])
  })

  it('记录无法解析的行', () => {
    const { parseErrors } = parseToGroups('[Desktop Entry]\n无效行\n')
    expect(parseErrors).toHaveLength(1)
    expect(parseErrors[0]).toContain('第 2 行')
  })
})

describe('serializeGroups', () => {
  it('round-trip 保留字段顺序', () => {
    const first = parseToGroups(SAMPLE)
    const out = serializeGroups(first.groups)
    const second = parseToGroups(out)
    expect(second.groups).toEqual(first.groups)
    expect(out).toContain('Name[zh_CN]=火狐浏览器')
  })
})

describe('getMainFields', () => {
  it('只取 Desktop Entry 组且首个值生效', () => {
    const fields = getMainFields(SAMPLE)
    expect(fields.Name).toBe('Firefox')
    expect(fields.Exec).toBe('/usr/lib/firefox/firefox %u')
  })

  it('无主组返回空对象', () => {
    expect(getMainFields('[Other]\nA=1\n')).toEqual({})
  })
})

describe('localizedValue', () => {
  const fields = [['Name', 'Firefox'], ['Name[zh_CN]', '火狐浏览器']]
  it('优先取本地化值', () => {
    expect(localizedValue(fields, 'Name', 'zh_CN')).toBe('火狐浏览器')
  })
  it('无本地化时回退', () => {
    expect(localizedValue(fields, 'Name', 'en_US')).toBe('Firefox')
    expect(localizedValue(fields, 'Comment', 'zh_CN')).toBe('')
  })
})

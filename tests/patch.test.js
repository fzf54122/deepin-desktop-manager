// @Time    : 2026/10/19 16:00
// @Author  : fzf
// @FileName: patch.test.js
// @Software: deepin-desktop-manager

import { describe, it, expect } from 'vitest'
import { patchDesktopEntry } from '../src/main/editor.js'

const SAMPLE = `# 应用注释，补丁必须保留
[Desktop Entry]
Type=Application
Name=Firefox
Name[zh_CN]=火狐浏览器
Exec=/usr/lib/firefox/firefox %u
# 行内注释也要保留
Terminal=false

[Desktop Action NewWindow]
Name=New Window
Exec=firefox --new-window %u
`

describe('patchDesktopEntry', () => {
  it('只改动目标键，注释/其他组/本地化键全部原样保留', () => {
    const out = patchDesktopEntry(SAMPLE, { Name: 'New Name', Terminal: 'true' })
    expect(out).toContain('# 应用注释，补丁必须保留')
    expect(out).toContain('# 行内注释也要保留')
    expect(out).toContain('Name=New Name')
    expect(out).toContain('Name[zh_CN]=火狐浏览器')
    expect(out).toContain('Terminal=true')
    expect(out).toContain('[Desktop Action NewWindow]')
    expect(out).toContain('Exec=firefox --new-window %u')
    // Exec 未在 updates 中时不被改动
    expect(out).toContain('Exec=/usr/lib/firefox/firefox %u')
  })

  it('新键插入到 Desktop Entry 段内而非其他组', () => {
    const out = patchDesktopEntry(SAMPLE, { NoDisplay: 'true' })
    const mainSection = out.split('[Desktop Action')[0]
    expect(mainSection).toContain('NoDisplay=true')
  })

  it('无 BOM 化：BOM 文件补丁后不带 BOM 且组头正常命中', () => {
    const withBom = '﻿' + SAMPLE
    const out = patchDesktopEntry(withBom, { Name: 'X' })
    expect(out.startsWith('﻿')).toBe(false)
    expect(out).toContain('Name=X')
  })

  it('缺失 [Desktop Entry] 组时自动补建', () => {
    const out = patchDesktopEntry('SomeText\n', { Name: 'A', Exec: 'b' })
    expect(out).toContain('[Desktop Entry]')
    expect(out).toContain('Name=A')
    expect(out).toContain('Exec=b')
  })

  it('空 updates 返回原内容（除 BOM）', () => {
    const out = patchDesktopEntry(SAMPLE, {})
    expect(out).toBe(SAMPLE)
  })
})

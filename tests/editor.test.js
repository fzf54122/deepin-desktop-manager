// @Time    : 2026/10/19 15:15
// @Author  : fzf
// @FileName: editor.test.js
// @Software: deepin-desktop-manager

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { saveDesktopFile, deleteDesktopFile, buildTemplate } from '../src/main/editor.js'

let workDir

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'dm-test-'))
})

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true })
})

const GROUPS = [
  { groupName: 'Desktop Entry', fields: [['Type', 'Application'], ['Name', 'Test'], ['Exec', '/bin/true']] }
]

describe('saveDesktopFile', () => {
  it('写入文件且内容可解析', async () => {
    const target = join(workDir, 'a.desktop')
    await saveDesktopFile(target, GROUPS)
    const content = await readFile(target, 'utf-8')
    expect(content).toContain('[Desktop Entry]')
    expect(content).toContain('Name=Test')
  })

  it('编辑已有文件时产生备份', async () => {
    const target = join(workDir, 'b.desktop')
    await saveDesktopFile(target, GROUPS)
    await saveDesktopFile(target, [
      { groupName: 'Desktop Entry', fields: [['Name', 'Changed']] }
    ])
    const content = await readFile(target, 'utf-8')
    expect(content).toContain('Name=Changed')
    const backups = await readdir(join(process.env.HOME, '.local/share/desktop-manager/backup'))
    expect(backups.some((f) => f.startsWith('b.desktop.'))).toBe(true)
  })

  it('拒绝非 .desktop 目标', async () => {
    await expect(saveDesktopFile(join(workDir, 'x.txt'), GROUPS)).rejects.toThrow(/\.desktop/)
  })
})

describe('deleteDesktopFile', () => {
  it('删除文件', async () => {
    const target = join(workDir, 'c.desktop')
    await writeFile(target, '[Desktop Entry]\nName=C\n')
    await deleteDesktopFile(target)
    await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('buildTemplate', () => {
  it('生成模板并指向用户目录', () => {
    const t = buildTemplate({ fileName: 'my-app', name: 'My App', exec: 'my-app %U', icon: '', comment: '测试', categories: 'Utility;', terminal: true })
    expect(t.fileName).toBe('my-app.desktop')
    expect(t.filePath).toContain('.local/share/applications')
    expect(t.content).toContain('Terminal=true')
    expect(t.content).toContain('Comment=测试')
    expect(t.content).not.toContain('Icon=')
  })
})

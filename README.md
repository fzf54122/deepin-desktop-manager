# deepin-desktop-manager

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Deepin-orange)
![Electron](https://img.shields.io/badge/Electron-22-47848F)

Deepin / Linux 桌面 `.desktop` 文件图形化管理工具：扫描、编辑、新建、删除多路径下的 desktop 文件。

## 功能

- **多路径扫描**：`~/.local/share/applications`、`/usr/share/applications`、flatpak 导出目录等，遵循 XDG union 语义并标注覆盖关系
- **编辑**：表单编辑常用字段 + 源码视图直改，未在表单中的字段（本地化 Name、Desktop Actions）原样保留
- **新建**：模板向导，固定写入用户目录
- **删除**：删除前自动备份到 `~/.local/share/desktop-manager/backup/`
- **系统文件只读**：`/usr/share` 下的文件不直接改，引导复制到用户目录（union 覆盖系统项），避免提权风险

## 截图

> TODO: 补充运行截图

## 安装

从 [Releases](https://github.com/fzf54122/deepin-desktop-manager/releases) 下载 deb 包安装：

```bash
sudo dpkg -i deepin-desktop-manager_<version>_amd64.deb
# 依赖缺失时
sudo apt-get install -f
```

运行时依赖 `libnotify4`（deb 包已声明）。

## 开发

```bash
npm install
npm run dev      # 开发模式
npm test         # 单元测试（parser / editor）
npm run dist     # 构建 + 打包到 release/（dir）
npm run dist:deb # 构建 + 打包 deb
```

## 技术栈

Electron 22（兼容 deepin 20.9 的 glibc 2.28）+ electron-vite + Vue 3 + Naive UI。

主进程负责文件 IO（原子写入 + 备份），渲染进程通过 contextBridge 暴露的 API 通信，开启 contextIsolation。

## 已知问题排查

**Plank / Dock 图标模糊或无法固定**：deb 包内 desktop 文件的 `StartupWMClass` 必须与 Electron 实际窗口类一致（本应用为 `deepin-desktop-manager`）。若安装旧版本后出现图标异常，可手动修正 `/opt/desktop-manager` 下或 `/usr/share/applications/deepin-desktop-manager.desktop` 中的 `StartupWMClass` 字段，然后重启 Plank（`pkill plank && nohup plank &`）。

## License

[MIT](LICENSE)

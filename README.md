# JCM-PIDS-Studio

JCM-PIDS-Studio 是一款面向 JCM / PIDS 资源制作流程的可视化编辑器。它把画布编辑、图层管理、属性配置、校验提示和资源导出整合在同一个工作台中，适合用于项目初始化、样式调整和资源包生成。

## 产品概述

JCM-PIDS-Studio 面向需要快速搭建和维护 PIDS 视觉资源的工作流。它支持在画布中直接编辑元素位置、尺寸与层级，并能同步生成项目 JSON、JavaScript 输出和资源包文件。

## 安装与启动

```bash
pnpm install
pnpm dev
```

启动后，请打开终端中显示的 Vite 地址，通常是 `http://localhost:5173/`。

## 常用命令

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

## 核心功能

- 画布编辑：支持元素位置、尺寸、层级与拖拽调整。
- 图层管理：支持显示、隐藏、锁定、删除、复制和排序。
- 元素类型：支持文本、矩形、贴图和线段。
- 模板编辑：支持 repeat row template，用于行模板场景。
- 交互辅助：支持 snap-to-grid、箭头微调、缩放和拖拽。
- 场景预览：内置多种 Mock Data 场景，便于检查不同显示状态。
- 校验提示：提供边界、颜色、纹理 ID、模板约束和导出兼容性检查。

## 导入与导出

- `Import` 支持项目 JSON、带嵌入元数据的生成 JS，以及 `joban_custom_resources.json`。
- `Export Project` 导出当前编辑状态的项目 JSON。
- `Export JS` 导出可直接用于 JCM 的脚本文件。
- `Export Resources` 导出 `joban_custom_resources.json`。
- `Export ZIP` 打包脚本、资源 JSON、项目元数据、`pack.mcmeta` 和占位纹理文件。

## 发布说明

- 当前版本采用 SVG 画布实现，便于快速编辑和稳定发布。
- `Route Chip` 已暂停，不会出现在组件库中，也不会参与当前编辑流程。
- 导出的 ZIP 中包含占位 `pixel.png` 和 `circle.png`，正式交付时请替换为实际资源。

## 目录结构

- `src/App.tsx`：应用入口与交互编排。
- `src/components/`：布局、画布、面板与通用 UI。
- `src/canvas/`：画布渲染与缩放逻辑。
- `src/editor/`：导入导出、校验、代码生成与绑定解析。
- `src/schema/`：项目结构归一化与解析。
- `src/store/`：编辑器状态管理。
- `src/data/`：Mock 数据。
- `src/__tests__/`：测试。

## 验证

```bash
pnpm build
```

如需继续修改功能，建议先执行 `pnpm typecheck`，再补充必要测试。

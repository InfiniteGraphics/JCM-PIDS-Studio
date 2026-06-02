# JS PIDS Visual Editor MVP

A lightweight web editor for JCM / PIDS style presets. It provides a visual canvas, layer management, property panels, validation hints, and import/export flows for project JSON, generated JavaScript, and resource-pack ZIP files.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173/`.

## Scripts

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

## What This MVP Supports

- Direct canvas editing for element position, size, and stacking order.
- Layer visibility, lock, delete, duplicate, and drag-to-reorder actions.
- Text, rect, texture, and line elements.
- Repeat row templates for row-based layouts.
- Snap-to-grid, arrow-key nudging, zoom, and drag interactions.
- Mock data switching for previewing different station and arrival scenarios.
- Project JSON import and export.
- Round-tripping project metadata from generated JavaScript.
- `joban_custom_resources.json` import and resource-pack ZIP export.
- Validation for bounds, colors, texture IDs, template constraints, and export compatibility.

## Import and Export

- `Import` supports project JSON, generated JS with embedded metadata, and `joban_custom_resources.json`.
- `Export Project` writes the current editor state as project JSON.
- `Export JS` generates the JCM script output.
- `Export Resources` writes `joban_custom_resources.json`.
- `Export ZIP` bundles the script, resource JSON, project metadata, `pack.mcmeta`, and placeholder textures into one archive.

## Current Notes

- The canvas is SVG-based to keep the MVP small and easy to iterate on.
- `Route Chip` is currently paused, so it does not appear in the component library or participate in the current editing flow.
- Exported ZIP files include placeholder `pixel.png` and `circle.png` textures. Replace them with production assets when needed.

## Project Layout

- `src/App.tsx` - application entry and interaction orchestration.
- `src/components/` - layout, canvas, panels, and shared UI.
- `src/canvas/` - canvas rendering and resize logic.
- `src/editor/` - import/export, validation, codegen, and binding resolution.
- `src/schema/` - project normalization and parsing.
- `src/store/` - editor state management.
- `src/data/` - mock data.
- `src/__tests__/` - tests.

## Verification

```bash
pnpm build
```

If you continue changing behavior, run `pnpm typecheck` first and add tests where they provide value.

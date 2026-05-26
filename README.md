# JS PIDS Visual Editor MVP

A Web-first MVP for visually designing JCM Scripted PIDS presets and generating JavaScript/resource-pack outputs.

## Run with PNPM

```bash
pnpm install
pnpm dev
```

Then open the Vite URL, usually `http://localhost:5173/`.

## Build

```bash
pnpm build
pnpm preview
```

## Implemented in this version

### P0

- Real Repeat Rows template model instead of hard-coded static rows.
- Data binding coverage for PIDS fields, ArrivalEntry fields, and computed fields.
- JCM-style JavaScript generator using `create(ctx, state, pids)`, `render(ctx, state, pids)`, and `dispose(ctx, state, pids)`.
- Codegen support for `Text.create()`, `Texture.create()`, route chips, `pids.rows`, `pids.arrivals().get(i)`, `pids.getCustomMessage(i)`, `pids.isRowHidden(i)`, and `pids.isPlatformNumberHidden()`.
- Custom message / hide platform / hide arrival behavior switches.
- Validation panel for bounds, colors, texture ids, row templates, and export settings.
- `joban_custom_resources.json` generation using `pids_images[].scriptFiles`.

### P1

- Layer delete / hide / lock.
- Drag-to-reorder layers within a group.
- Duplicate layers.
- Resize handles on selected elements.
- Snap-to-grid and arrow-key nudging.
- Mock scenarios: normal, long destination, custom message, hidden row, hide platform, empty arrivals, terminating train.
- Project JSON import/export.
- Basic import of `joban_custom_resources.json` into a new editable project shell.
- Resource-pack ZIP export with script, `joban_custom_resources.json`, project metadata JSON, `pack.mcmeta`, and placeholder `pixel.png` / `circle.png` textures.

## Notes

- The canvas is still SVG-based to keep the MVP light. A future high-fidelity editor can migrate this surface to Konva/Fabric without changing the core schema/codegen model.
- Existing arbitrary handwritten JS cannot be fully reverse-engineered. This version supports round-tripping project JSON, and generated JS includes embedded project metadata for future import support.
- Placeholder texture files are included in exported ZIPs. Replace them with real texture assets in a production resource pack.

## Manual JCM Smoke Test Checklist

- `rv_pids`: normal arrivals
- `rv_pids`: custom message
- `rv_pids`: hidden row
- `rv_pids`: hide platform number
- `rv_pids`: empty arrival rows
- `lcd_pids`: normal arrivals
- Confirm generated preset appears in JCM preset list
- Confirm generated resource pack loads without script error

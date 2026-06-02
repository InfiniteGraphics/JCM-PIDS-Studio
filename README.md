
# JCM-PIDS-Studio

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Vite](https://img.shields.io/badge/built%20with-Vite-646CFF.svg?style=flat&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/frontend-React%2019-61DAFB.svg?style=flat&logo=react)](https://react.dev/)

JCM-PIDS-Studio is a professional, visual workbench and WYSIWYG layout editor tailored for the **Joban Custom Map (JCM) Passenger Information Display System (PIDS)** resource pipeline. 

It bridges the gap between layout design and script execution by embedding real-time canvas configuration, dynamic data binding previews, real-time validation compliance, and automated resource compilation into a single workflow.

---

## 🚀 User Guide

This section covers everything you need to know to create, preview, and bundle PIDS layouts for your custom resource packs.

### Key Features
- **Visual Grid Canvas Layouts:** Direct WYSIWYG positioning, scaling, and depth configuration for texts, bounding blocks, decorative lines, and canvas elements.
- **Dynamic Data Binding Previews:** Bind fields natively to train arrival telemetry (`arrival.destination()`, `computed.etaText`, etc.) and simulate complex environments directly within the browser.
- **Multi-Scenario Mocking:** Instantly toggle between operational environments (e.g., normal timetables, custom text overrides, long destinations, empty lists) to stress-test layout constraints.
- **Automated Compilation:** Instantly exports executable JCM JavaScript wrappers, customized asset resource sheets, or ready-to-use Minecraft resource pack `.zip` files.

### Working with the Studio

#### 1. Designing Your Board
- Use the **Components** sidebar to drop objects onto the viewport. Choose between **Global Layers** (persistent elements like background blocks and station clocks) or the **Repeat Row Template** (which loops through active train schedules dynamically).
- Use **Snapping Guides** and arrow-key nudges to optimize your boundaries.

#### 2. Mocking Data Environments
The studio includes a reactive runtime context built into the top control strip. You can switch between active test profiles:
- `Normal`: Regular commuter schedule loops.
- `Custom Message`: High-priority service interruption overlays.
- `Long Destination`: Text overflow stress tests (e.g., scales down long string inputs).
- `Terminating` / `Hidden Rows`: Non-standard track operational states.

#### 3. Import and Export Schemes
- **Export Project:** Saves your raw project metadata profile (`.json`) so you can resume editing later.
- **Export JS / Resources:** Extracts standalone scripts and mappings compatible with the standard JCM runtime architecture.
- **Export ZIP (Recommended):** Generates a complete, ready-to-load Minecraft resource pack bundle containing structural assets, script hierarchies, `pack.mcmeta` templates, and placeholder manifests.

---

## 🛠️ Developer & Contributor Guide

This section details the system architecture, internal modules, and development workflow for programmers contributing to the studio project.

### Core Architecture
The codebase is structured strictly around linear data management, an SVG-backed workspace editor, and JCM specification wrappers:

```text
src/
├── canvas/          # SVG UI calculations, scaling matrices, and handle transforms
├── components/      # UI hierarchy (split sidebars, panels, toolbar clusters)
├── data/            # Timetable simulators and diagnostic context factories
├── editor/          # JCM validation pipelines, code generation engines, and zip builders
├── schema/          # Data migrations (v2 -> v3 parser) and schema validators
└── store/           # Global state orchestrators, history states (Undo/Redo stack)

```

### Script Generation Architecture

When generating standalone client scripts, the system takes the abstract state model (`PidsProject`) and outputs optimized, JCM v2.2 specification compliant API pipelines:

* It loops absolute elements and compiles chained `Text.create(...)` or `Texture.create(...)` call-stacks.
* It embeds a packed base64 string of the editor's data model right into the script comments (`@js-pids-editor-project:...`), allowing full, lossless project recovery when users import a compiled file back into the app.

### Local Development Setup

#### Prerequisites

Make sure you have Node.js (v20+) and **pnpm** installed on your machine.

#### Installation

Clone the repository and install all developer environment dependencies:

```bash
git clone [https://github.com/infinitegraphics/jcm-pids-studio.git](https://github.com/infinitegraphics/jcm-pids-studio.git)
cd jcm-pids-studio
pnpm install

```

#### Dev Server

Spin up the local Vite-backed asset pipelines:

```bash
pnpm dev

```

Navigate to the local address displayed in your terminal (typically `http://localhost:5173/`).

### Project Tasks

| Command | Action |
| --- | --- |
| `pnpm dev` | Starts the interactive dev server |
| `pnpm typecheck` | Runs the TypeScript compiler check (`tsc --noEmit`) |
| `pnpm test` | Runs the Vitest pipeline suite |
| `pnpm build` | Compiles a production-ready web bundle to the `dist/` directory |
| `pnpm preview` | Tests your production build locally |

---

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.


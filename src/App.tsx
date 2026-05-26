import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasWorkbench } from './components/canvasView';
import { LeftSidebar, SCENARIOS, TopToolbar } from './components/layout';
import { StatusNotice, Tabs } from './components/common';
import { Inspector, ProjectInspector, RepeatRowsInspector, ValidationPanel } from './components/panels';
import { clamp, getRenderedElements, round } from './canvas/rendering';
import { resizeFromHandle, type ResizeHandle } from './canvas/resize';
import { safePresetId, uid } from './editor/defaultProject';
import { importProjectText } from './editor/importExport';
import { issueSummary } from './editor/validation';
import { DEFAULT_CANVAS_ZOOM, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM, useEditorStore } from './store/editorStore';
import type { PidsElement, TextureAsset } from './types';

const GRID_SIZE = 0.5;

export default function App() {
  const store = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textureInputRef = useRef<HTMLInputElement | null>(null);
  const [leftTab, setLeftTab] = useState<'Components' | 'Layers'>('Components');
  const [rightTab, setRightTab] = useState<'Properties' | 'Bindings' | 'Style'>('Properties');
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ id: string; rowIndex?: number; offsetX: number; offsetY: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ id: string; rowIndex?: number; handle: ResizeHandle; startX: number; startY: number; start: PidsElement } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  const renderedElements = useMemo(() => getRenderedElements(store.project, store.runtime), [store.project, store.runtime]);
  const validationSummary = useMemo(() => issueSummary(store.validationIssues), [store.validationIssues]);
  const compatibilitySummary = useMemo(() => issueSummary(store.compatibilityIssues), [store.compatibilityIssues]);
  const assetUrls = useMemo(
    () =>
      Object.fromEntries(
        store.project.assets.map((asset) => [asset.id, `data:${asset.mimeType};base64,${asset.dataBase64}`])
      ),
    [store.project.assets]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;
      if (isTyping) return;

      if ((event.key === 'Delete' || event.key === 'Backspace') && store.selectedId && store.selectedId !== '__repeatRows') {
        event.preventDefault();
        store.deleteElement(store.selectedId);
      }

      if (store.selected && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 2 : GRID_SIZE;
        const patch: Partial<PidsElement> = {};
        if (event.key === 'ArrowUp') patch.y = round(store.selected.y - step);
        if (event.key === 'ArrowDown') patch.y = round(store.selected.y + step);
        if (event.key === 'ArrowLeft') patch.x = round(store.selected.x - step);
        if (event.key === 'ArrowRight') patch.x = round(store.selected.x + step);
        store.updateElement(store.selected.id, patch);
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && store.selected) {
        event.preventDefault();
        store.duplicateElement(store.selected.id);
        setStatusMessage({ tone: 'success', text: '已复制当前元素。' });
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c' && store.selected) {
        event.preventDefault();
        if (store.copySelectedElement()) {
          setStatusMessage({ tone: 'success', text: `已复制元素：${store.selected.name}` });
        }
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        const pastedId = store.pasteElement();
        if (pastedId) {
          setStatusMessage({ tone: 'success', text: '已粘贴元素副本。' });
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  function download(filename: string, content: string, type = 'text/plain') {
    const blob = new Blob([content], { type });
    downloadBlob(filename, blob);
  }

  function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportZip() {
    if (store.exportSummary.errors > 0) {
      window.alert('Export blocked. Resolve validation or compatibility errors first.');
      return;
    }
    const result = await store.exportZip();
    downloadBlob(`${store.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'pids'}-resource-pack.zip`, result.blob);
    setStatusMessage({ tone: 'success', text: `已导出 ZIP，共 ${result.manifest.files.length} 个文件。` });
  }

  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importProjectText(String(reader.result));
        store.setWholeProject(imported.project, imported.project.elements[0]?.id ?? '');
        setStatusMessage({ tone: 'success', text: `导入成功，来源：${imported.source}` });
      } catch (error) {
        setStatusMessage({ tone: 'error', text: error instanceof Error ? error.message : '导入失败。' });
        window.alert(error instanceof Error ? error.message : 'Invalid import file.');
      }
    };
    reader.readAsText(file);
  }

  function handleImportTexture(file: File) {
    if (file.type !== 'image/png') {
      setStatusMessage({ tone: 'error', text: '目前只支持导入 PNG 图片。' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const prefix = 'base64,';
      const index = raw.indexOf(prefix);
      if (index === -1) {
        setStatusMessage({ tone: 'error', text: 'PNG 读取失败。' });
        return;
      }
      const baseName = file.name.replace(/\.png$/i, '');
      const safeName = safePresetId(baseName);
      const asset: TextureAsset = {
        id: uid('asset'),
        name: baseName,
        textureId: `${store.project.resourceNamespace}:textures/imported/${safeName}.png`,
        zipPath: `assets/${store.project.resourceNamespace}/textures/imported/${safeName}.png`,
        mimeType: 'image/png',
        dataBase64: raw.slice(index + prefix.length)
      };
      store.addAsset(asset);
      setStatusMessage({ tone: 'success', text: `已导入图片：${file.name}` });
    };
    reader.readAsDataURL(file);
  }

  function pointerToCanvas(event: React.PointerEvent<SVGElement>) {
    const svg = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * store.project.canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * store.project.canvas.height
    };
  }

  function snap(value: number) {
    return store.snapToGrid ? Math.round(value / GRID_SIZE) * GRID_SIZE : round(value);
  }

  function onCanvasPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const point = pointerToCanvas(event);
    if (dragState) {
      const element = store.project.elements.find((item) => item.id === dragState.id);
      if (!element) return;
      const rowOffset =
        element.parentId === store.project.repeatRows.groupId && typeof dragState.rowIndex === 'number'
          ? store.project.repeatRows.startY + dragState.rowIndex * store.project.repeatRows.rowHeight
          : 0;

      store.updateElementLive(dragState.id, {
        x: clamp(snap(point.x - dragState.offsetX), 0, store.project.canvas.width),
        y: snap(point.y - dragState.offsetY - rowOffset)
      } as Partial<PidsElement>);
    }

    if (resizeState) {
      const dx = point.x - resizeState.startX;
      const dy = point.y - resizeState.startY;
      const patch = resizeFromHandle(resizeState.start, resizeState.handle, dx, dy, GRID_SIZE, store.snapToGrid);
      store.updateElementLive(resizeState.id, patch);
    }
  }

  function startDrag(event: React.PointerEvent<SVGElement>, rendered: ReturnType<typeof getRenderedElements>[number]) {
    if (rendered.element.locked) return;
    event.stopPropagation();
    const point = pointerToCanvas(event);
    store.beginInteraction();
    store.setSelectedId(rendered.element.id);
    setDragState({
      id: rendered.element.id,
      rowIndex: rendered.rowIndex,
      offsetX: point.x - rendered.x,
      offsetY: point.y - rendered.y
    });
  }

  function startResize(event: React.PointerEvent<SVGRectElement>, element: PidsElement, rowIndex: number | undefined, handle: ResizeHandle) {
    event.stopPropagation();
    const point = pointerToCanvas(event);
    store.beginInteraction();
    store.setSelectedId(element.id);
    setResizeState({ id: element.id, rowIndex, handle, startX: point.x, startY: point.y, start: structuredClone(element) });
  }

  return (
    <div className="app-shell">
      <TopToolbar
        project={store.project}
        zoom={store.zoom}
        snapToGrid={store.snapToGrid}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        canPaste={store.canPaste}
        onPresetChange={(preset) =>
          store.updateProject((draft) => {
            draft.preset = preset;
            if (preset === 'lcd_pids') draft.canvas = { width: 133, height: 72 };
            if (preset === 'rv_pids') draft.canvas = { width: 136, height: 76 };
            if (preset === 'pids_1a') draft.canvas = { width: 96, height: 48 };
          })
        }
        onZoomOut={() => store.setZoom((value) => Math.max(MIN_CANVAS_ZOOM, value - 1))}
        onZoomIn={() => store.setZoom((value) => Math.min(MAX_CANVAS_ZOOM, value + 1))}
        onSnapChange={store.setSnapToGrid}
        onNewProject={() => {
          if (window.confirm('这会清空当前编辑内容并新建一个默认 Project，是否继续？')) {
            store.newProject();
            setStatusMessage({ tone: 'info', text: '已新建默认 Project。' });
          }
        }}
        onImport={() => fileInputRef.current?.click()}
        onExportProject={() => {
          download('pids-project.json', JSON.stringify(store.project, null, 2), 'application/json');
          setStatusMessage({ tone: 'success', text: '已导出 Project JSON。' });
        }}
        onExportJs={() => {
          if (store.exportSummary.errors > 0) {
            window.alert('Export blocked. Resolve validation or compatibility errors first.');
            return;
          }
          download(store.artifacts.scriptFilename, store.artifacts.script, 'text/javascript');
          setStatusMessage({ tone: 'success', text: `已导出脚本：${store.artifacts.scriptFilename}` });
        }}
        onExportResources={() => {
          download('joban_custom_resources.json', store.artifacts.resourceJson, 'application/json');
          setStatusMessage({ tone: 'success', text: '已导出 joban_custom_resources.json。' });
        }}
        onExportZip={handleExportZip}
        onPaste={() => {
          const pastedId = store.pasteElement();
          if (pastedId) {
            setStatusMessage({ tone: 'success', text: '已粘贴元素副本。' });
          }
        }}
        onUndo={store.undo}
        onRedo={store.redo}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json,.js,text/javascript"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleImport(file);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={textureInputRef}
        type="file"
        accept="image/png,.png"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleImportTexture(file);
          event.currentTarget.value = '';
        }}
      />

      {statusMessage && (
        <div className="status-banner">
          <StatusNotice tone={statusMessage.tone} message={statusMessage.text} />
        </div>
      )}

      <main className="layout">
        <LeftSidebar
          project={store.project}
          activeTab={leftTab}
          selectedId={store.selectedId}
          dragLayerId={dragLayerId}
          onTabChange={(tab) => setLeftTab(tab as 'Components' | 'Layers')}
          onSetSelectedId={store.setSelectedId}
          onSetDragLayerId={setDragLayerId}
          onToggleGroupVisibility={(id) => store.updateGroup(id, { visible: !store.project.groups.find((group) => group.id === id)?.visible })}
          onToggleGroupExpanded={(id) => {
            const group = store.project.groups.find((item) => item.id === id);
            store.updateGroup(id, { expanded: group?.expanded === false ? true : false });
          }}
          onAddComponent={store.addComponent}
          onToggleVisible={(element) => store.updateElement(element.id, { visible: !element.visible })}
          onToggleLocked={(element) => store.updateElement(element.id, { locked: !element.locked })}
          onDeleteElement={store.deleteElement}
          onMoveLayer={store.moveLayer}
        />

        <section className="workbench-shell">
          <CanvasWorkbench
            project={store.project}
            runtime={store.runtime}
            assetUrls={assetUrls}
            scenario={store.scenario}
            zoom={store.zoom}
            renderedElements={renderedElements}
            selectedId={store.selectedId}
            onScenarioChange={(value) => store.setScenario(value as typeof SCENARIOS[number]['value'])}
            onReset={store.resetProject}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={() => {
              setDragState(null);
              setResizeState(null);
              store.endInteraction();
            }}
            onClearSelection={() => store.setSelectedId('')}
            onElementPointerDown={startDrag}
            onResizeStart={startResize}
          />

          <section className="code-panel">
            <div className="code-panel-header">
              <div><span className="js-chip">JS</span> Code Preview (JavaScript)</div>
              <div><button onClick={() => navigator.clipboard.writeText(store.artifacts.script)}>Copy</button></div>
            </div>
            <pre><code>{store.artifacts.script}</code></pre>
          </section>
        </section>

        <aside className="sidebar inspector">
          <Tabs active={rightTab} items={['Properties', 'Bindings', 'Style']} onChange={(tab) => setRightTab(tab as 'Properties' | 'Bindings' | 'Style')} />
          {rightTab === 'Properties' && (
            <>
              <ProjectInspector
                project={store.project}
                onChange={(patch) => store.updateProject((draft) => Object.assign(draft, patch))}
                onImportTexture={() => textureInputRef.current?.click()}
                onRemoveAsset={store.removeAsset}
              />
              {store.selectedId === '__repeatRows' ? (
                <RepeatRowsInspector project={store.project} onChange={(patch) => store.updateProject((draft) => { draft.repeatRows = { ...draft.repeatRows, ...patch }; })} />
              ) : store.selected ? (
                <Inspector
                  element={store.selected}
                  isTemplate={store.selected.parentId === store.project.repeatRows.groupId}
                  project={store.project}
                  onChange={(patch) => store.updateElement(store.selected!.id, patch)}
                  onDuplicate={() => store.duplicateElement(store.selected!.id)}
                  onDelete={() => store.deleteElement(store.selected!.id)}
                  onMoveUp={() => store.reorderZ(store.selected!.id, 1)}
                  onMoveDown={() => store.reorderZ(store.selected!.id, -1)}
                />
              ) : (
                <div className="empty-state">Select a layer or canvas element to edit its properties.</div>
              )}
            </>
          )}
          {rightTab === 'Bindings' && (
            <>
              <ValidationPanel
                title={`Validation - ${validationSummary.errors} errors / ${validationSummary.warnings} warnings`}
                issues={store.validationIssues}
                selectedId={store.selectedId}
                onSelect={store.setSelectedId}
              />
              <ValidationPanel
                title={`Compatibility - ${compatibilitySummary.errors} errors / ${compatibilitySummary.warnings} warnings`}
                issues={store.compatibilityIssues}
                selectedId={store.selectedId}
                onSelect={store.setSelectedId}
              />
            </>
          )}
          {rightTab === 'Style' && (
            <section className="panel-section generated-json">
              <h3 className="panel-title">Resource JSON</h3>
              <pre>{store.artifacts.resourceJson}</pre>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasWorkbench } from './components/canvasView';
import { LeftSidebar, SCENARIOS, TopToolbar } from './components/layout';
import { StatusNotice, Tabs } from './components/common';
import { Inspector, ProjectInspector, TextureAssetsPanel, ValidationPanel } from './components/panels';
import { clamp, getRenderedElements, round } from './canvas/rendering';
import { resizeFromHandle, type AnyResizeHandle } from './canvas/resize';
import { safePresetId, uid } from './editor/defaultProject';
import { importProjectText } from './editor/importExport';
import { issueSummary } from './editor/validation';
import { DEFAULT_CANVAS_ZOOM, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM, useEditorStore } from './store/editorStore';
import type { PidsElement, TextureAsset } from './types';

const GRID_SIZE = 0.5;
const SNAP_THRESHOLD = 1.5;

export default function App() {
  const store = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textureInputRef = useRef<HTMLInputElement | null>(null);
  const [leftTab, setLeftTab] = useState<'Components' | 'Layers'>('Components');
  const [rightTab, setRightTab] = useState<'Properties' | 'Bindings' | 'Style' | 'Texture Assets'>('Properties');
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>('root');
  const [dragState, setDragState] = useState<{ id: string; rowIndex?: number; offsetX: number; offsetY: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ id: string; rowIndex?: number; handle: AnyResizeHandle; startX: number; startY: number; start: PidsElement } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const templateGroupId = 'rowTemplate';

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
    const globalGroups = store.project.groups.filter((group) => group.id !== templateGroupId);
    const selectedGroup = store.selected?.parentId;
    if (selectedGroup && globalGroups.some((group) => group.id === selectedGroup)) {
      setTargetGroupId(selectedGroup);
      return;
    }
    if (!globalGroups.some((group) => group.id === targetGroupId)) {
      setTargetGroupId(globalGroups[0]?.id ?? 'root');
    }
  }, [store.project.groups, store.selected, targetGroupId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;
      if (isTyping) return;

      if ((event.key === 'Delete' || event.key === 'Backspace') && store.selectedId) {
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

      const image = new Image();
      image.onload = () => {
        const baseName = file.name.replace(/\.png$/i, '');
        const safeName = safePresetId(baseName);
        const asset: TextureAsset = {
          id: uid('asset'),
          name: baseName,
          textureId: `${store.project.resourceNamespace}:textures/imported/${safeName}.png`,
          zipPath: `assets/${store.project.resourceNamespace}/textures/imported/${safeName}.png`,
          mimeType: 'image/png',
          dataBase64: raw.slice(index + prefix.length),
          width: image.naturalWidth,
          height: image.naturalHeight
        };
        store.addAsset(asset);
        setStatusMessage({ tone: 'success', text: `已导入图片：${file.name}` });
      };
      image.onerror = () => {
        setStatusMessage({ tone: 'error', text: 'PNG 尺寸读取失败。' });
      };
      image.src = raw;
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

  function collectSnapTargets(excludeId?: string) {
    const xTargets = new Set<number>([0, store.project.canvas.width / 2, store.project.canvas.width]);
    const yTargets = new Set<number>([0, store.project.canvas.height / 2, store.project.canvas.height]);

    store.project.guides.forEach((guide) => {
      if (guide.axis === 'x') xTargets.add(guide.value);
      else yTargets.add(guide.value);
    });

    store.project.elements
      .filter((element) => element.id !== excludeId && element.parentId !== templateGroupId)
      .forEach((element) => {
        xTargets.add(element.x);
        xTargets.add(element.x + element.w / 2);
        xTargets.add(element.x + element.w);
        yTargets.add(element.y);
        yTargets.add(element.y + element.h / 2);
        yTargets.add(element.y + element.h);
      });

    return {
      x: Array.from(xTargets),
      y: Array.from(yTargets)
    };
  }

  function alignAxis(start: number, size: number, targets: number[]) {
    const anchors = [
      { kind: 'start' as const, value: start },
      { kind: 'center' as const, value: start + size / 2 },
      { kind: 'end' as const, value: start + size }
    ];
    let best: { value: number; delta: number } | null = null;

    for (const anchor of anchors) {
      for (const target of targets) {
        const delta = target - anchor.value;
        if (Math.abs(delta) > SNAP_THRESHOLD) continue;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) {
          best = {
            value: round(start + delta),
            delta
          };
        }
      }
    }

    return best ? best.value : round(start);
  }

  function snapElementPosition(element: PidsElement, nextX: number, nextY: number) {
    const gridX = clamp(snap(nextX), 0, store.project.canvas.width);
    const gridY = round(nextY);
    const targets = collectSnapTargets(element.id);
    const alignedX = alignAxis(gridX, element.w, targets.x);
    const alignedY = alignAxis(gridY, element.h, targets.y);

    return {
      x: clamp(alignedX, 0, store.project.canvas.width),
      y: alignedY
    };
  }

  function onCanvasPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const point = pointerToCanvas(event);
    if (dragState) {
      const element = store.project.elements.find((item) => item.id === dragState.id);
      if (!element) return;
      const repeat = element.repeat;
      const rowOffset =
        element.parentId === templateGroupId && repeat && typeof dragState.rowIndex === 'number'
          ? {
              x: dragState.rowIndex * (repeat.direction === 'horizontal' ? element.w + repeat.gap : 0),
              y: dragState.rowIndex * (repeat.direction === 'vertical' ? element.h + repeat.gap : 0)
            }
          : { x: 0, y: 0 };
      const nextBaseX = point.x - dragState.offsetX - rowOffset.x;
      const nextBaseY = point.y - dragState.offsetY - rowOffset.y;
      const snapped = snapElementPosition(element, nextBaseX, nextBaseY);

      store.updateElementLive(dragState.id, {
        x: snapped.x,
        y: snapped.y
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

  function startResize(event: React.PointerEvent<SVGElement>, element: PidsElement, rowIndex: number | undefined, handle: AnyResizeHandle) {
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
          targetGroupId={targetGroupId}
          onTabChange={(tab) => setLeftTab(tab as 'Components' | 'Layers')}
          onSetSelectedId={store.setSelectedId}
          onSetDragLayerId={setDragLayerId}
          onToggleGroupVisibility={(id) => store.updateGroup(id, { visible: !store.project.groups.find((group) => group.id === id)?.visible })}
          onToggleGroupExpanded={(id) => {
            const group = store.project.groups.find((item) => item.id === id);
            store.updateGroup(id, { expanded: group?.expanded === false ? true : false });
          }}
          onAddGroup={store.addGroup}
          onRenameGroup={store.renameGroup}
          onDeleteGroup={store.deleteGroup}
          onTargetGroupChange={setTargetGroupId}
          onAddComponent={store.addComponent}
          onToggleVisible={(element) => store.updateElement(element.id, { visible: !element.visible })}
          onToggleLocked={(element) => store.updateElement(element.id, { locked: !element.locked })}
          onDeleteElement={store.deleteElement}
          onMoveLayer={store.moveLayer}
          onMoveElementToGroup={store.moveElementToGroup}
        />

        <section className="workbench-shell">
          <CanvasWorkbench
            project={store.project}
            runtime={store.runtime}
            assetUrls={assetUrls}
            scenario={store.scenario}
            zoom={store.zoom}
            guides={store.project.guides}
            renderedElements={renderedElements}
            selectedId={store.selectedId}
            onScenarioChange={(value) => store.setScenario(value as typeof SCENARIOS[number]['value'])}
            onReset={store.resetProject}
            onClearGuides={() => store.updateProject((draft) => { draft.guides = []; })}
            onCreateGuide={(axis, value) => store.updateProject((draft) => {
              draft.guides.push({ id: uid('guide'), axis, value: round(value) });
            })}
            onRemoveGuide={(id) => store.updateProject((draft) => {
              draft.guides = draft.guides.filter((guide) => guide.id !== id);
            })}
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
          <Tabs active={rightTab} items={['Properties', 'Bindings', 'Style', 'Texture Assets']} onChange={(tab) => setRightTab(tab as 'Properties' | 'Bindings' | 'Style' | 'Texture Assets')} />
          {rightTab === 'Properties' && (
            <>
              <ProjectInspector
                project={store.project}
                onChange={(patch) => store.updateProject((draft) => Object.assign(draft, patch))}
                onOpenTextureAssets={() => setRightTab('Texture Assets')}
              />
              {store.selected ? (
                <Inspector
                  element={store.selected}
                  project={store.project}
                  onMoveToGroup={store.moveElementToGroup}
                  onTextureAssetChange={store.updateTextureElementAsset}
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
          {rightTab === 'Texture Assets' && (
            <TextureAssetsPanel
              assets={store.project.assets}
              onImportTexture={() => textureInputRef.current?.click()}
              onUpdateAsset={store.updateAsset}
              onRemoveAsset={store.removeAsset}
              onBack={() => setRightTab('Properties')}
            />
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

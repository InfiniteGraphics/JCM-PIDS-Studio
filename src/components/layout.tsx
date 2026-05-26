import type { MockScenario, PidsElement, PidsProject } from '../types';
import { ComponentButton, PanelTitle, Tabs } from './common';

export const SCENARIOS: { label: string; value: MockScenario }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Long destination', value: 'longDestination' },
  { label: 'Custom message', value: 'customMessage' },
  { label: 'Hidden row', value: 'hiddenRow' },
  { label: 'Hide platform', value: 'hidePlatform' },
  { label: 'Empty arrivals', value: 'emptyArrivals' },
  { label: 'Terminating', value: 'terminating' }
];

export function TopToolbar({
  project,
  zoom,
  snapToGrid,
  canUndo,
  canRedo,
  onPresetChange,
  onZoomOut,
  onZoomIn,
  onSnapChange,
  onImport,
  onExportProject,
  onExportJs,
  onExportResources,
  onExportZip,
  onUndo,
  onRedo
}: {
  project: PidsProject;
  zoom: number;
  snapToGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onPresetChange: (preset: PidsProject['preset']) => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onSnapChange: (checked: boolean) => void;
  onImport: () => void;
  onExportProject: () => void;
  onExportJs: () => void;
  onExportResources: () => void;
  onExportZip: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="window-dots"><span /><span /><span /></div>
        <div className="app-icon">▧</div>
        <strong>JS PIDS Visual Editor</strong>
        <span className="badge">v0.1</span>
      </div>
      <div className="toolbar-group">
        <label>Preset</label>
        <select value={project.preset} onChange={(event) => onPresetChange(event.target.value as PidsProject['preset'])}>
          <option value="rv_pids">RV PIDS</option>
          <option value="rv_pids_sil_1">RV PIDS SIL 1</option>
          <option value="rv_pids_sil_2">RV PIDS SIL 2</option>
          <option value="lcd_pids">LCD PIDS</option>
          <option value="pids_projector">PIDS Projector</option>
          <option value="pids_1a">PIDS 1A</option>
        </select>
        <label>Canvas</label>
        <span className="pill">{project.canvas.width} × {project.canvas.height}</span>
        <label>Zoom</label>
        <button onClick={onZoomOut}>-</button>
        <span className="pill">{Math.round(zoom * 100)}%</span>
        <button onClick={onZoomIn}>+</button>
        <label className="inline-check"><input type="checkbox" checked={snapToGrid} onChange={(event) => onSnapChange(event.target.checked)} /> Snap</label>
        <button onClick={onUndo} disabled={!canUndo}>Undo</button>
        <button onClick={onRedo} disabled={!canRedo}>Redo</button>
      </div>
      <div className="toolbar-actions">
        <button className="ghost" onClick={onImport}>Import</button>
        <button className="ghost" onClick={onExportProject}>Export Project</button>
        <button className="primary" onClick={onExportJs}>Export JS</button>
        <button className="ghost" onClick={onExportResources}>Export Resources</button>
        <button className="ghost" onClick={onExportZip}>Export ZIP</button>
      </div>
    </header>
  );
}

export function LeftSidebar({
  project,
  selectedId,
  dragLayerId,
  onSetSelectedId,
  onSetDragLayerId,
  onToggleGroupVisibility,
  onAddComponent,
  onToggleVisible,
  onToggleLocked,
  onDeleteElement,
  onMoveLayer
}: {
  project: PidsProject;
  selectedId: string;
  dragLayerId: string | null;
  onSetSelectedId: (id: string) => void;
  onSetDragLayerId: (id: string | null) => void;
  onToggleGroupVisibility: (id: string) => void;
  onAddComponent: (kind: 'text' | 'rect' | 'circle' | 'line', parentId: string) => void;
  onToggleVisible: (element: PidsElement) => void;
  onToggleLocked: (element: PidsElement) => void;
  onDeleteElement: (id: string) => void;
  onMoveLayer: (dragId: string, targetId: string) => void;
}) {
  return (
    <aside className="sidebar left-sidebar">
      <Tabs active="Components" items={['Components', 'Layers']} />
      <section className="panel-section">
        <PanelTitle title="Component Library" />
        <div className="component-grid-label">Global layers</div>
        <ComponentButton icon="T" label="Text" onClick={() => onAddComponent('text', 'root')} />
        <ComponentButton icon="▧" label="Texture / Rect" onClick={() => onAddComponent('rect', 'root')} />
        <ComponentButton icon="●" label="Route Chip" onClick={() => onAddComponent('circle', 'root')} />
        <ComponentButton icon="─" label="Line" onClick={() => onAddComponent('line', 'root')} />
        <div className="component-grid-label">Repeat row template</div>
        <ComponentButton icon="T" label="Row Text" onClick={() => onAddComponent('text', 'rowTemplate')} />
        <ComponentButton icon="▧" label="Row Texture" onClick={() => onAddComponent('rect', 'rowTemplate')} />
        <ComponentButton icon="●" label="Row Route Chip" onClick={() => onAddComponent('circle', 'rowTemplate')} />
        <ComponentButton icon="─" label="Row Line" onClick={() => onAddComponent('line', 'rowTemplate')} />
        <ComponentButton icon="⚙" label="Repeat Rows Settings" hint="pids.rows loop" onClick={() => onSetSelectedId('__repeatRows')} />
      </section>
      <section className="panel-section layer-section">
        <PanelTitle title="Layers" />
        {project.groups.map((group) => (
          <div key={group.id} className="layer-group">
            <div className="layer-group-title">
              <button className="layer-icon-button" onClick={() => onToggleGroupVisibility(group.id)}>{group.visible ? '◉' : '○'}</button>
              <button className="group-title-button" onClick={() => group.id === project.repeatRows.groupId && onSetSelectedId('__repeatRows')}>▸ {group.name}</button>
            </div>
            {project.elements
              .filter((element) => element.parentId === group.id)
              .sort((a, b) => a.z - b.z)
              .map((element) => (
                <button
                  key={element.id}
                  className={`layer-row ${element.id === selectedId ? 'selected' : ''}`}
                  draggable
                  onDragStart={() => onSetDragLayerId(element.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragLayerId) onMoveLayer(dragLayerId, element.id);
                    onSetDragLayerId(null);
                  }}
                  onClick={() => onSetSelectedId(element.id)}
                >
                  <span className="layer-icon">{element.kind === 'text' ? 'T' : element.kind === 'circle' ? '●' : element.kind === 'line' ? '─' : '▧'}</span>
                  <span>
                    {element.name}
                    {element.parentId === project.repeatRows.groupId && <small>{element.condition ?? 'always'}</small>}
                  </span>
                  <span className="layer-actions">
                    <button
                      type="button"
                      className="layer-icon-button"
                      title={element.visible ? 'Hide layer' : 'Show layer'}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleVisible(element);
                      }}
                    >
                      {element.visible ? '◉' : '○'}
                    </button>
                    <button
                      type="button"
                      className="layer-icon-button"
                      title={element.locked ? 'Unlock layer' : 'Lock layer'}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleLocked(element);
                      }}
                    >
                      {element.locked ? '🔒' : '🔓'}
                    </button>
                    <button
                      type="button"
                      className="layer-icon-button danger-icon"
                      title="Delete layer"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteElement(element.id);
                      }}
                    >
                      ×
                    </button>
                    <span className="layer-drag-handle">⋮⋮</span>
                  </span>
                </button>
              ))}
          </div>
        ))}
      </section>
    </aside>
  );
}

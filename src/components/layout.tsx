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
  canPaste,
  onPresetChange,
  onZoomOut,
  onZoomIn,
  onSnapChange,
  onNewProject,
  onImport,
  onExportProject,
  onExportJs,
  onExportResources,
  onExportZip,
  onPaste,
  onUndo,
  onRedo
}: {
  project: PidsProject;
  zoom: number;
  snapToGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  onPresetChange: (preset: PidsProject['preset']) => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onSnapChange: (checked: boolean) => void;
  onNewProject: () => void;
  onImport: () => void;
  onExportProject: () => void;
  onExportJs: () => void;
  onExportResources: () => void;
  onExportZip: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="window-dots"><span /><span /><span /></div>
        <div className="app-icon">JP</div>
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
        <span className="pill">{project.canvas.width} x {project.canvas.height}</span>
        <label>Zoom</label>
        <button type="button" onClick={onZoomOut}>-</button>
        <span className="pill">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={onZoomIn}>+</button>
        <label className="inline-check"><input type="checkbox" checked={snapToGrid} onChange={(event) => onSnapChange(event.target.checked)} /> Snap</label>
        <button type="button" onClick={onUndo} disabled={!canUndo}>Undo</button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>Redo</button>
      </div>
      <div className="toolbar-actions">
        <button type="button" className="ghost" onClick={onNewProject}>New Project</button>
        <button type="button" className="ghost" onClick={onImport}>Import</button>
        <button type="button" className="ghost" onClick={onPaste} disabled={!canPaste}>Paste</button>
        <button type="button" className="ghost" onClick={onExportProject}>Export Project</button>
        <button type="button" className="primary" onClick={onExportJs}>Export JS</button>
        <button type="button" className="ghost" onClick={onExportResources}>Export Resources</button>
        <button type="button" className="ghost" onClick={onExportZip}>Export ZIP</button>
      </div>
    </header>
  );
}

export function LeftSidebar({
  project,
  activeTab,
  selectedId,
  dragLayerId,
  onTabChange,
  onSetSelectedId,
  onSetDragLayerId,
  onToggleGroupVisibility,
  onToggleGroupExpanded,
  onAddComponent,
  onToggleVisible,
  onToggleLocked,
  onDeleteElement,
  onMoveLayer
}: {
  project: PidsProject;
  activeTab: 'Components' | 'Layers';
  selectedId: string;
  dragLayerId: string | null;
  onTabChange: (tab: 'Components' | 'Layers') => void;
  onSetSelectedId: (id: string) => void;
  onSetDragLayerId: (id: string | null) => void;
  onToggleGroupVisibility: (id: string) => void;
  onToggleGroupExpanded: (id: string) => void;
  onAddComponent: (kind: 'text' | 'rect' | 'circle' | 'line', parentId: string) => void;
  onToggleVisible: (element: PidsElement) => void;
  onToggleLocked: (element: PidsElement) => void;
  onDeleteElement: (id: string) => void;
  onMoveLayer: (dragId: string, targetId: string) => void;
}) {
  return (
    <aside className="sidebar left-sidebar">
      <Tabs active={activeTab} items={['Components', 'Layers']} onChange={(tab) => onTabChange(tab as 'Components' | 'Layers')} />
      {activeTab === 'Components' && (
        <section className="panel-section">
          <PanelTitle title="Component Library" />
          <div className="component-grid-label">Global layers</div>
          <ComponentButton icon="T" label="Text" onClick={() => onAddComponent('text', 'root')} />
          <ComponentButton icon="R" label="Texture / Rect" onClick={() => onAddComponent('rect', 'root')} />
          <ComponentButton icon="C" label="Route Chip" onClick={() => onAddComponent('circle', 'root')} />
          <ComponentButton icon="L" label="Line" onClick={() => onAddComponent('line', 'root')} />
          <div className="component-grid-label">Repeat row template</div>
          <ComponentButton icon="T" label="Row Text" onClick={() => onAddComponent('text', 'rowTemplate')} />
          <ComponentButton icon="R" label="Row Texture" onClick={() => onAddComponent('rect', 'rowTemplate')} />
          <ComponentButton icon="C" label="Row Route Chip" onClick={() => onAddComponent('circle', 'rowTemplate')} />
          <ComponentButton icon="L" label="Row Line" onClick={() => onAddComponent('line', 'rowTemplate')} />
          <ComponentButton icon="S" label="Repeat Rows Settings" hint="pids.rows loop" onClick={() => onSetSelectedId('__repeatRows')} />
        </section>
      )}
      {activeTab === 'Layers' && (
        <section className="panel-section layer-section">
          <PanelTitle title="Layers" />
          {project.groups.map((group) => (
            <div key={group.id} className="layer-group">
              <div className="layer-group-title">
                <button type="button" className="layer-icon-button text-toggle" onClick={() => onToggleGroupVisibility(group.id)}>
                  {group.visible ? 'On' : 'Off'}
                </button>
                <button type="button" className="group-title-button" onClick={() => onToggleGroupExpanded(group.id)}>
                  {group.expanded === false ? '>' : 'v'} {group.name}
                </button>
                {group.id === project.repeatRows.groupId && (
                  <button type="button" className="layer-icon-button text-toggle" title="Edit repeat rows settings" onClick={() => onSetSelectedId('__repeatRows')}>
                    Set
                  </button>
                )}
              </div>
              {group.expanded !== false && project.elements
                .filter((element) => element.parentId === group.id)
                .sort((a, b) => a.z - b.z)
                .map((element) => (
                  <button
                    key={element.id}
                    type="button"
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
                    <span className="layer-icon">{element.kind === 'text' ? 'T' : element.kind === 'circle' ? 'C' : element.kind === 'line' ? 'L' : 'R'}</span>
                    <span>
                      {element.name}
                      {element.parentId === project.repeatRows.groupId && <small>{element.condition ?? 'always'}</small>}
                    </span>
                    <span className="layer-actions">
                      <button
                        type="button"
                        className="layer-icon-button text-toggle"
                        title={element.visible ? 'Hide layer' : 'Show layer'}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleVisible(element);
                        }}
                      >
                        {element.visible ? 'On' : 'Off'}
                      </button>
                      <button
                        type="button"
                        className="layer-icon-button text-toggle"
                        title={element.locked ? 'Unlock layer' : 'Lock layer'}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleLocked(element);
                        }}
                      >
                        {element.locked ? 'Lock' : 'Free'}
                      </button>
                      <button
                        type="button"
                        className="layer-icon-button danger-icon text-toggle"
                        title="Delete layer"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteElement(element.id);
                        }}
                      >
                        Del
                      </button>
                      <span className="layer-drag-handle">::</span>
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}

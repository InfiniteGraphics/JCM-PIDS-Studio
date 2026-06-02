import type { MockScenario, PidsElement, PidsProject } from '../types';
import { ComponentButton, PanelTitle, Tabs } from './common';
import { DEFAULT_CANVAS_ZOOM } from '../store/editorStore';

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
  const zoomPercent = Math.round((zoom / DEFAULT_CANVAS_ZOOM) * 100);

  return (
    <header className="topbar">
      <div className="brand">
        <div className="window-dots"><span /><span /><span /></div>
        <div className="app-icon">JP</div>
        <strong>JCM-PIDS-Studio</strong>
        <span className="badge">v0.1</span>
      </div>
      <div className="toolbar-group">
        <label>Canvas</label>
        <span className="pill">{project.canvas.width} x {project.canvas.height}</span>
        <label>Zoom</label>
        <button type="button" onClick={onZoomOut}>-</button>
        <span className="pill">{zoomPercent}%</span>
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
  targetGroupId,
  onTabChange,
  onSetSelectedId,
  onSetDragLayerId,
  onToggleGroupVisibility,
  onToggleGroupExpanded,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onTargetGroupChange,
  onAddComponent,
  onToggleVisible,
  onToggleLocked,
  onDeleteElement,
  onMoveLayer,
  onMoveElementToGroup
}: {
  project: PidsProject;
  activeTab: 'Components' | 'Layers';
  selectedId: string;
  dragLayerId: string | null;
  targetGroupId: string;
  onTabChange: (tab: 'Components' | 'Layers') => void;
  onSetSelectedId: (id: string) => void;
  onSetDragLayerId: (id: string | null) => void;
  onToggleGroupVisibility: (id: string) => void;
  onToggleGroupExpanded: (id: string) => void;
  onAddGroup: () => void;
  onRenameGroup: (id: string, name: string) => void;
  onDeleteGroup: (id: string) => void;
  onTargetGroupChange: (id: string) => void;
  onAddComponent: (kind: 'text' | 'rect' | 'texture' | 'circle' | 'line', parentId: string) => void;
  onToggleVisible: (element: PidsElement) => void;
  onToggleLocked: (element: PidsElement) => void;
  onDeleteElement: (id: string) => void;
  onMoveLayer: (dragId: string, targetId: string) => void;
  onMoveElementToGroup: (elementId: string, groupId: string) => void;
}) {
  return (
    <aside className="sidebar left-sidebar">
      <Tabs active={activeTab} items={['Components', 'Layers']} onChange={(tab) => onTabChange(tab as 'Components' | 'Layers')} />
      {activeTab === 'Components' && (
        <section className="panel-section">
          <PanelTitle title="Component Library" />
          <label className="field">
            <span>Target Layer</span>
            <select value={targetGroupId} onChange={(event) => onTargetGroupChange(event.target.value)}>
              {project.groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
          <div className="component-grid-label">Global layers</div>
          <ComponentButton icon="T" label="Text" onClick={() => onAddComponent('text', targetGroupId)} />
          <ComponentButton icon="R" label="Rect" onClick={() => onAddComponent('rect', targetGroupId)} />
          <ComponentButton icon="I" label="Texture" onClick={() => onAddComponent('texture', targetGroupId)} />
          {/* Route Chip is temporarily disabled until its editor/export bugs are fixed. */}
          {/* <ComponentButton icon="C" label="Route Chip" onClick={() => onAddComponent('circle', targetGroupId)} /> */}
          <ComponentButton icon="L" label="Line" onClick={() => onAddComponent('line', targetGroupId)} />
          <div className="component-grid-label">Repeat row template</div>
          <ComponentButton icon="T" label="Row Text" onClick={() => onAddComponent('text', 'rowTemplate')} />
          <ComponentButton icon="R" label="Row Rect" onClick={() => onAddComponent('rect', 'rowTemplate')} />
          <ComponentButton icon="I" label="Row Texture" onClick={() => onAddComponent('texture', 'rowTemplate')} />
          {/* <ComponentButton icon="C" label="Row Route Chip" onClick={() => onAddComponent('circle', 'rowTemplate')} /> */}
          <ComponentButton icon="L" label="Row Line" onClick={() => onAddComponent('line', 'rowTemplate')} />
        </section>
      )}
      {activeTab === 'Layers' && (
        <section className="panel-section layer-section">
          <div className="panel-header-row">
            <PanelTitle title="Layers" />
            <button type="button" className="ghost-inline" onClick={onAddGroup}>New Layer</button>
          </div>
          {project.groups.map((group) => (
            <div
              key={group.id}
              className={`layer-group ${dragLayerId ? 'drop-enabled' : ''}`}
              onDragOver={(event) => {
                if (!dragLayerId) return;
                event.preventDefault();
              }}
              onDrop={() => {
                if (!dragLayerId) return;
                onMoveElementToGroup(dragLayerId, group.id);
                onSetDragLayerId(null);
              }}
            >
              <div className="layer-group-title">
                <button type="button" className="layer-icon-button text-toggle" onClick={() => onToggleGroupVisibility(group.id)}>
                  {group.visible ? 'On' : 'Off'}
                </button>
                <button type="button" className="group-title-button" onClick={() => onToggleGroupExpanded(group.id)}>
                  {group.expanded === false ? '>' : 'v'} {group.name}
                </button>
                <button
                  type="button"
                  className="layer-icon-button text-toggle"
                  title="Rename layer"
                  onClick={() => {
                    const nextName = window.prompt('Rename layer', group.name);
                    if (nextName != null) onRenameGroup(group.id, nextName);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="layer-icon-button danger-icon text-toggle"
                  title="Delete layer"
                  onClick={() => {
                    if (window.confirm(`Delete layer "${group.name}"? Its elements will move to another layer.`)) {
                      onDeleteGroup(group.id);
                    }
                  }}
                >
                  Del
                </button>
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
                    onDragEnd={() => onSetDragLayerId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragLayerId) onMoveLayer(dragLayerId, element.id);
                      onSetDragLayerId(null);
                    }}
                    onClick={() => onSetSelectedId(element.id)}
                  >
                    <span className="layer-icon">{element.kind === 'text' ? 'T' : element.kind === 'circle' ? 'C' : element.kind === 'line' ? 'L' : element.kind === 'texture' ? 'I' : 'R'}</span>
                    <span>
                      {element.name}
                      {element.repeat?.enabled && <small>{element.repeat.direction} x {element.repeat.count}</small>}
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

import type React from 'react';
import { resolveElementText } from '../editor/bindings';
import type { GuideLine, MockRuntime, PidsElement, PidsProject } from '../types';
import { fitPreviewText } from '../canvas/rendering';
import type { RenderedElement } from '../canvas/rendering';
import type { ResizeHandle } from '../canvas/resize';
import { Rulers } from './common';

export function CanvasWorkbench({
  project,
  runtime,
  assetUrls,
  scenario,
  zoom,
  guides,
  renderedElements,
  selectedId,
  onScenarioChange,
  onReset,
  onClearGuides,
  onCreateGuide,
  onRemoveGuide,
  onPointerMove,
  onPointerUp,
  onClearSelection,
  onElementPointerDown,
  onResizeStart
}: {
  project: PidsProject;
  runtime: MockRuntime;
  assetUrls: Record<string, string>;
  scenario: string;
  zoom: number;
  guides: GuideLine[];
  renderedElements: RenderedElement[];
  selectedId: string;
  onScenarioChange: (value: string) => void;
  onReset: () => void;
  onClearGuides: () => void;
  onCreateGuide: (axis: 'x' | 'y', value: number) => void;
  onRemoveGuide: (id: string) => void;
  onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onClearSelection: () => void;
  onElementPointerDown: (event: React.PointerEvent<SVGElement>, rendered: RenderedElement) => void;
  onResizeStart: (event: React.PointerEvent<SVGRectElement>, element: PidsElement, rowIndex: number | undefined, handle: ResizeHandle) => void;
}) {
  return (
    <section className="canvas-workbench">
      <div className="canvas-toolbar">
        <div>
          <strong>Visual Canvas</strong>
          <span>Element repeat preview, resize handles, snapping guides, keyboard nudging</span>
        </div>
        <div className="scenario-group">
          <label>Mock Data</label>
          <select value={scenario} onChange={(event) => onScenarioChange(event.target.value)}>
            <option value="normal">Normal</option>
            <option value="longDestination">Long destination</option>
            <option value="customMessage">Custom message</option>
            <option value="hiddenRow">Hidden row</option>
            <option value="hidePlatform">Hide platform</option>
            <option value="emptyArrivals">Empty arrivals</option>
            <option value="terminating">Terminating</option>
          </select>
          <button onClick={onClearGuides} disabled={guides.length === 0}>Clear Guides</button>
          <button onClick={onReset}>Reset</button>
        </div>
        <div className="guide-group">
          <label>Guides</label>
          <div className="guide-list">
            {guides.length === 0 ? (
              <span className="guide-empty">None</span>
            ) : (
              guides.map((guide) => (
                <button
                  key={guide.id}
                  type="button"
                  className="guide-chip"
                  title={`Remove ${guide.axis.toUpperCase()} guide at ${guide.value.toFixed(1)}`}
                  onClick={() => onRemoveGuide(guide.id)}
                >
                  {guide.axis.toUpperCase()} {guide.value.toFixed(1)}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div
        className="canvas-stage"
        style={{
          '--canvas-width': `${project.canvas.width * zoom}px`,
          '--canvas-height': `${project.canvas.height * zoom}px`,
          '--canvas-frame-width': `${project.canvas.width * zoom + 34}px`,
          '--canvas-frame-height': `${project.canvas.height * zoom + 24}px`
        } as React.CSSProperties}
      >
        <div className="canvas-stage-inner">
          <div className="canvas-frame">
            <Rulers width={project.canvas.width} height={project.canvas.height} zoom={zoom} onCreateGuide={onCreateGuide} />
            <svg
              className="pids-canvas"
              width={project.canvas.width * zoom}
              height={project.canvas.height * zoom}
              viewBox={`0 0 ${project.canvas.width} ${project.canvas.height}`}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onPointerDown={onClearSelection}
            >
              <defs>
                <pattern id="small-grid" width="4" height="4" patternUnits="userSpaceOnUse">
                  <path d="M 4 0 L 0 0 0 4" fill="none" stroke="#243347" strokeWidth="0.18" />
                </pattern>
              </defs>
              <rect x="0" y="0" width={project.canvas.width} height={project.canvas.height} fill="url(#small-grid)" />
              <line x1={project.canvas.width / 2} x2={project.canvas.width / 2} y1={0} y2={project.canvas.height} stroke="#18d2d5" strokeWidth="0.25" strokeDasharray="1 1" />
              <line y1={project.canvas.height / 2} y2={project.canvas.height / 2} x1={0} x2={project.canvas.width} stroke="#18d2d5" strokeWidth="0.25" strokeDasharray="1 1" />
              {guides.map((guide) =>
                guide.axis === 'x' ? (
                  <line
                    key={guide.id}
                    x1={guide.value}
                    x2={guide.value}
                    y1={0}
                    y2={project.canvas.height}
                    className="guide-line"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onRemoveGuide(guide.id);
                    }}
                  />
                ) : (
                  <line
                    key={guide.id}
                    x1={0}
                    x2={project.canvas.width}
                    y1={guide.value}
                    y2={guide.value}
                    className="guide-line"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onRemoveGuide(guide.id);
                    }}
                  />
                )
              )}
              {renderedElements.map((rendered) => (
                <ElementView
                  key={rendered.key}
                  rendered={rendered}
                  runtime={runtime}
                  assetUrls={assetUrls}
                  selected={rendered.element.id === selectedId}
                  onPointerDown={(event) => onElementPointerDown(event, rendered)}
                  onResizeStart={onResizeStart}
                />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function ElementView({
  rendered,
  runtime,
  assetUrls,
  selected,
  onPointerDown,
  onResizeStart
}: {
  rendered: RenderedElement;
  runtime: MockRuntime;
  assetUrls: Record<string, string>;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent<SVGElement>) => void;
  onResizeStart: (event: React.PointerEvent<SVGRectElement>, element: PidsElement, rowIndex: number | undefined, handle: ResizeHandle) => void;
}) {
  const { element, x, y, rowIndex } = rendered;
  const previewRowIndex = typeof rowIndex === 'number' && runtime.rows > 0 ? rowIndex % runtime.rows : rowIndex;
  const context = { runtime, rowIndex: previewRowIndex };
  const isTemplateInstance = typeof rowIndex === 'number' && element.parentId === 'rowTemplate' && Boolean(element.repeat?.enabled);

  if (element.kind === 'rect') {
    return (
      <g onPointerDown={onPointerDown} className="canvas-element">
        <rect x={x} y={y} width={element.w} height={element.h} fill={element.fill} stroke={element.stroke ?? 'none'} strokeWidth="0.35" rx={element.radius ?? 0} opacity={element.opacity ?? 1} />
        {selected && <SelectionBox element={element} x={x} y={y} rowIndex={rowIndex} isTemplateInstance={isTemplateInstance} onResizeStart={onResizeStart} />}
      </g>
    );
  }

  if (element.kind === 'texture') {
    const assetHref = element.assetId ? assetUrls[element.assetId] ?? null : null;
    return (
      <g onPointerDown={onPointerDown} className="canvas-element">
        {assetHref ? (
          <image href={assetHref} x={x} y={y} width={element.w} height={element.h} opacity={element.opacity ?? 1} preserveAspectRatio="xMidYMid meet" />
        ) : (
          <rect x={x} y={y} width={element.w} height={element.h} fill={element.tint ?? '#ffffff'} stroke="#2ffff8" strokeDasharray="1 1" opacity={element.opacity ?? 1} />
        )}
        {selected && <SelectionBox element={element} x={x} y={y} rowIndex={rowIndex} isTemplateInstance={isTemplateInstance} onResizeStart={onResizeStart} />}
      </g>
    );
  }

  if (element.kind === 'line') {
    return (
      <g onPointerDown={onPointerDown} className="canvas-element">
        <line x1={x} y1={y} x2={x + element.w} y2={y + element.h} stroke={element.stroke} strokeWidth={element.strokeWidth} />
        {selected && <SelectionBox element={{ ...element, h: Math.max(element.h, 1) }} x={x} y={y} rowIndex={rowIndex} isTemplateInstance={isTemplateInstance} onResizeStart={onResizeStart} />}
      </g>
    );
  }

  if (element.kind === 'circle') {
    // Route Chip is temporarily disabled until its editor/export bugs are fixed.
    return null;
  }

  const text = resolveElementText(element, context);
  if (!text) return null;
  const anchor = element.align === 'center' ? 'middle' : element.align === 'right' ? 'end' : 'start';
  const textX = element.align === 'center' ? x + element.w / 2 : element.align === 'right' ? x + element.w : x;

  return (
    <g onPointerDown={onPointerDown} className="canvas-element">
      {element.shadow && <text x={textX + 0.5} y={y + element.h * 0.72 + 0.5} fill="#000000" opacity="0.55" fontSize={element.fontSize} fontWeight={element.fontWeight === 'bold' ? 700 : 400} textAnchor={anchor}>{fitPreviewText(text, element.w, element.fontSize)}</text>}
      <text x={textX} y={y + element.h * 0.72} fill={element.color} fontSize={element.fontSize} fontStyle={element.italic ? 'italic' : 'normal'} fontWeight={element.fontWeight === 'bold' ? 700 : 400} textAnchor={anchor}>{fitPreviewText(text, element.w, element.fontSize)}</text>
      {selected && <SelectionBox element={element} x={x} y={y} rowIndex={rowIndex} isTemplateInstance={isTemplateInstance} onResizeStart={onResizeStart} />}
    </g>
  );
}

function SelectionBox({
  element,
  x,
  y,
  rowIndex,
  isTemplateInstance,
  onResizeStart
}: {
  element: PidsElement;
  x: number;
  y: number;
  rowIndex?: number;
  isTemplateInstance: boolean;
  onResizeStart: (event: React.PointerEvent<SVGRectElement>, element: PidsElement, rowIndex: number | undefined, handle: ResizeHandle) => void;
}) {
  const handles: Array<[ResizeHandle, number, number]> = [
    ['nw', x, y],
    ['ne', x + element.w, y],
    ['sw', x, y + element.h],
    ['se', x + element.w, y + element.h]
  ];

  return (
    <g className="selection-box">
      <rect x={x} y={y} width={element.w} height={element.h} fill="none" stroke="#2ffff8" strokeWidth="0.45" strokeDasharray="1 0.8" />
      {isTemplateInstance && (
        <text x={x} y={y - 1.2} className="template-badge">row {typeof rowIndex === 'number' ? rowIndex + 1 : ''} template</text>
      )}
      {handles.map(([handle, hx, hy]) => (
        <rect key={handle} className={`resize-handle resize-${handle}`} x={hx - 0.85} y={hy - 0.85} width="1.7" height="1.7" fill="#2ffff8" onPointerDown={(event) => onResizeStart(event, element, rowIndex, handle)} />
      ))}
    </g>
  );
}

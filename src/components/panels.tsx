import { BINDING_OPTIONS } from '../editor/bindings';
import type {
  ElementCondition,
  PidsElement,
  PidsProject,
  RectElement,
  TextElement,
  TextureAsset,
  TextureElement,
  TextureAssetUpdate,
  ValidationIssue
} from '../types';
import { ColorInput, NumberInput, PanelTitle, TextInput } from './common';

export function ProjectInspector({
  project,
  onChange,
  onOpenTextureAssets
}: {
  project: PidsProject;
  onChange: (patch: Partial<PidsProject>) => void;
  onOpenTextureAssets: () => void;
}) {
  return (
    <section className="panel-section inspector-stack compact-section">
      <PanelTitle title="Project" />
      <TextInput label="Preset name" value={project.name} onChange={(name) => onChange({ name })} />
      <div className="property-grid two">
        <TextInput label="Namespace" value={project.resourceNamespace} onChange={(resourceNamespace) => onChange({ resourceNamespace })} />
        <TextInput label="Script path" value={project.scriptPath} onChange={(scriptPath) => onChange({ scriptPath })} />
      </div>
      <div className="property-grid two">
        <NumberInput label="Canvas W" value={project.canvas.width} onChange={(width) => onChange({ canvas: { ...project.canvas, width } })} />
        <NumberInput label="Canvas H" value={project.canvas.height} onChange={(height) => onChange({ canvas: { ...project.canvas, height } })} />
      </div>
      <div className="check-grid">
        <label><input type="checkbox" checked={project.behavior.respectCustomMessage} onChange={(event) => onChange({ behavior: { ...project.behavior, respectCustomMessage: event.target.checked } })} /> Custom message</label>
        <label><input type="checkbox" checked={project.behavior.respectHidePlatformNumber} onChange={(event) => onChange({ behavior: { ...project.behavior, respectHidePlatformNumber: event.target.checked } })} /> Hide platform</label>
        <label><input type="checkbox" checked={project.behavior.respectHideArrival} onChange={(event) => onChange({ behavior: { ...project.behavior, respectHideArrival: event.target.checked } })} /> Hide arrival</label>
        <label><input type="checkbox" checked={project.behavior.autoZOrdering} onChange={(event) => onChange({ behavior: { ...project.behavior, autoZOrdering: event.target.checked } })} /> Auto Z</label>
      </div>
      <div className="button-row single">
        <button type="button" onClick={onOpenTextureAssets}>View Texture Assets</button>
      </div>
    </section>
  );
}

export function TextureAssetsPanel({
  assets,
  onImportTexture,
  onUpdateAsset,
  onRemoveAsset,
  onBack
}: {
  assets: TextureAsset[];
  onImportTexture: () => void;
  onUpdateAsset: (assetId: string, patch: TextureAssetUpdate) => void;
  onRemoveAsset: (assetId: string) => void;
  onBack: () => void;
}) {
  return (
    <section className="panel-section inspector-stack compact-section">
      <div className="panel-header-row">
        <PanelTitle title="Texture Assets" />
        <button type="button" className="ghost-inline" onClick={onBack}>Back</button>
      </div>
      <div className="button-row single">
        <button type="button" onClick={onImportTexture}>Import PNG</button>
      </div>
      {assets.length === 0 ? (
        <div className="valid-state">No texture assets imported.</div>
      ) : (
        <div className="texture-assets-list">
          {assets.map((asset) => (
            <div key={asset.id} className="texture-asset-card">
              <div className="texture-asset-thumb">
                <img src={`data:${asset.mimeType};base64,${asset.dataBase64}`} alt={asset.name} />
              </div>
              <div className="texture-asset-fields">
                <TextInput label="Name" value={asset.name} onChange={(name) => onUpdateAsset(asset.id, { name })} />
                <TextInput label="Texture ID" value={asset.textureId} onChange={(textureId) => onUpdateAsset(asset.id, { textureId })} />
                <div className="texture-asset-meta">{asset.width} x {asset.height}</div>
                <div className="texture-asset-meta">{asset.zipPath}</div>
                <button type="button" className="danger" onClick={() => onRemoveAsset(asset.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Inspector({
  element,
  project,
  onMoveToGroup,
  onTextureAssetChange,
  onChange,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown
}: {
  element: PidsElement;
  project: PidsProject;
  onMoveToGroup: (elementId: string, groupId: string) => void;
  onTextureAssetChange: (elementId: string, assetId: string | undefined) => void;
  onChange: (patch: Partial<PidsElement>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <section className="panel-section inspector-stack">
      <PanelTitle title="Selected Element" />
      <TextInput label="Name" value={element.name} onChange={(name) => onChange({ name })} />
      <div className="property-grid two">
        <NumberInput label="X" value={element.x} onChange={(x) => onChange({ x })} />
        <NumberInput label="Y" value={element.y} onChange={(y) => onChange({ y })} />
        <NumberInput label="W" value={element.w} onChange={(w) => onChange({ w: Math.max(0.5, w) })} />
        <NumberInput label="H" value={element.h} onChange={(h) => onChange({ h: Math.max(0.5, h) })} />
        <NumberInput label="Z" value={element.z} onChange={(z) => onChange({ z })} />
        <label className="field check-field"><input type="checkbox" checked={element.visible} onChange={(event) => onChange({ visible: event.target.checked })} /> Visible</label>
      </div>
      <label className="field">
        <span>Layer</span>
        <select value={element.parentId ?? 'root'} onChange={(event) => onMoveToGroup(element.id, event.target.value)}>
          {project.groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Condition</span>
        <select value={element.condition ?? 'always'} onChange={(event) => onChange({ condition: event.target.value as ElementCondition })}>
          <option value="always">Always</option>
          <option value="arrival">Arrival</option>
          <option value="platformVisible">Platform visible</option>
          <option value="customMessage">Custom message</option>
        </select>
      </label>
      <RepeatInspector element={element} onChange={onChange as (patch: Partial<PidsElement>) => void} />
      {element.kind === 'text' && <TextInspector element={element} onChange={onChange as (patch: Partial<TextElement>) => void} />}
      {element.kind === 'rect' && <RectInspector element={element} onChange={onChange} />}
      {element.kind === 'texture' && <TextureInspector element={element} assets={project.assets} onAssetChange={onTextureAssetChange} onChange={onChange as (patch: Partial<TextureElement>) => void} />}
      {element.kind === 'circle' && <CircleInspector element={element} onChange={onChange} />}
      {element.kind === 'line' && <LineInspector element={element} onChange={onChange} />}
      <div className="button-row"><button onClick={onMoveDown}>Send Back</button><button onClick={onMoveUp}>Bring Front</button></div>
      <div className="button-row"><button onClick={onDuplicate}>Duplicate</button><button className="danger" onClick={onDelete}>Delete</button></div>
    </section>
  );
}

function RepeatInspector({
  element,
  onChange
}: {
  element: PidsElement;
  onChange: (patch: Partial<PidsElement>) => void;
}) {
  const repeat = element.repeat ?? { enabled: false, count: 1, direction: 'vertical', gap: 0 };
  return (
    <>
      <PanelTitle title="Repeat" />
      <div className="property-grid two">
        <NumberInput label="Count" value={repeat.count} step={1} onChange={(count) => onChange({ repeat: { ...repeat, count: Math.max(1, Math.round(count)) } })} />
        <NumberInput label="Gap" value={repeat.gap} onChange={(gap) => onChange({ repeat: { ...repeat, gap } })} />
        <label className="field">
          <span>Direction</span>
          <select value={repeat.direction} onChange={(event) => onChange({ repeat: { ...repeat, direction: event.target.value as 'vertical' | 'horizontal' } })}>
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </label>
        <label className="field check-field">
          <input type="checkbox" checked={repeat.enabled} onChange={(event) => onChange({ repeat: { ...repeat, enabled: event.target.checked } })} />
          Repeat enabled
        </label>
      </div>
    </>
  );
}

function TextInspector({ element, onChange }: { element: TextElement; onChange: (patch: Partial<TextElement>) => void }) {
  return (
    <>
      <PanelTitle title="Text Style" />
      <TextInput label="Static Text" value={element.text} onChange={(text) => onChange({ text })} />
      <ColorInput label="Color" value={element.color} onChange={(color) => onChange({ color })} />
      <div className="property-grid two">
        <NumberInput label="Size" value={element.fontSize} onChange={(fontSize) => onChange({ fontSize })} />
        <TextInput label="Font ID" value={element.font ?? ''} onChange={(font) => onChange({ font })} />
      </div>
      <div className="property-grid two">
        <label className="field"><span>Weight</span><select value={element.fontWeight} onChange={(event) => onChange({ fontWeight: event.target.value as TextElement['fontWeight'] })}><option value="normal">Normal</option><option value="bold">Bold</option></select></label>
        <label className="field"><span>Align</span><select value={element.align} onChange={(event) => onChange({ align: event.target.value as TextElement['align'] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      </div>
      <label className="field"><span>Overflow</span><select value={element.overflow} onChange={(event) => onChange({ overflow: event.target.value as TextElement['overflow'] })}><option value="none">None</option><option value="stretchXY">Stretch XY</option><option value="scaleXY">Scale XY</option><option value="wrapText">Wrap text</option><option value="marquee">Marquee</option></select></label>
      {element.overflow === 'marquee' && <NumberInput label="Marquee Duration" value={element.marqueeDuration ?? 100} onChange={(marqueeDuration) => onChange({ marqueeDuration })} />}
      <div className="check-grid"><label><input type="checkbox" checked={Boolean(element.italic)} onChange={(event) => onChange({ italic: event.target.checked })} /> Italic</label><label><input type="checkbox" checked={Boolean(element.shadow)} onChange={(event) => onChange({ shadow: event.target.checked })} /> Shadow</label></div>
      <PanelTitle title="Binding" />
      <label className="field"><span>Binding</span><select value={element.binding} onChange={(event) => onChange({ binding: event.target.value as TextElement['binding'] })}>{BINDING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.group} 路 {option.label}</option>)}</select></label>
      <NumberInput label="Fixed Row Index" value={element.rowIndex ?? 0} onChange={(rowIndex) => onChange({ rowIndex })} />
      <TextInput label="Fallback" value={element.fallback} onChange={(fallback) => onChange({ fallback })} />
    </>
  );
}

function RectInspector({ element, onChange }: { element: RectElement; onChange: (patch: Partial<PidsElement>) => void }) {
  return (
    <>
      <PanelTitle title="Rect Style" />
      <ColorInput label="Fill" value={element.fill} onChange={(fill) => onChange({ fill } as Partial<PidsElement>)} />
      <ColorInput label="Stroke" value={element.stroke ?? '#55708f'} onChange={(stroke) => onChange({ stroke } as Partial<PidsElement>)} />
      <NumberInput label="Opacity" value={element.opacity ?? 1} onChange={(opacity) => onChange({ opacity } as Partial<PidsElement>)} />
      <NumberInput label="Radius" value={element.radius ?? 0} onChange={(radius) => onChange({ radius } as Partial<PidsElement>)} />
    </>
  );
}

function TextureInspector({
  element,
  assets,
  onAssetChange,
  onChange
}: {
  element: TextureElement;
  assets: TextureAsset[];
  onAssetChange: (elementId: string, assetId: string | undefined) => void;
  onChange: (patch: Partial<TextureElement>) => void;
}) {
  const linkedAsset = element.assetId ? assets.find((asset) => asset.id === element.assetId) ?? null : null;

  return (
    <>
      <PanelTitle title="Texture Style" />
      <label className="field">
        <span>Asset</span>
        <select
          value={element.assetId ?? ''}
          onChange={(event) => {
            onAssetChange(element.id, event.target.value || undefined);
          }}
        >
          <option value="">Use texture ID only</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.name}</option>
          ))}
        </select>
      </label>
      <TextInput label="Texture ID" value={element.textureId} onChange={(textureId) => onChange({ textureId })} />
      <ColorInput label="Tint" value={element.tint ?? '#ffffff'} onChange={(tint) => onChange({ tint })} />
      <NumberInput label="Opacity" value={element.opacity ?? 1} onChange={(opacity) => onChange({ opacity })} />
      {linkedAsset && (
        <div className="asset-preview-inline">
          <div className="asset-preview-frame">
            <img src={`data:image/png;base64,${linkedAsset.dataBase64}`} alt={element.name} />
          </div>
        </div>
      )}
    </>
  );
}

function CircleInspector({ element, onChange }: { element: Extract<PidsElement, { kind: 'circle' }>; onChange: (patch: Partial<PidsElement>) => void }) {
  return (
    <>
      <PanelTitle title="Route Chip" />
      <TextInput label="Fallback Text" value={element.text ?? ''} onChange={(text) => onChange({ text } as Partial<PidsElement>)} />
      <label className="field"><span>Binding</span><select value={element.binding ?? 'static'} onChange={(event) => onChange({ binding: event.target.value as TextElement['binding'] } as Partial<PidsElement>)}>{BINDING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.group} 路 {option.label}</option>)}</select></label>
      <TextInput label="Texture ID" value={element.textureId ?? ''} onChange={(textureId) => onChange({ textureId } as Partial<PidsElement>)} />
      <ColorInput label="Fill" value={element.fill} onChange={(fill) => onChange({ fill } as Partial<PidsElement>)} />
      <ColorInput label="Text Color" value={element.textColor ?? '#ffffff'} onChange={(textColor) => onChange({ textColor } as Partial<PidsElement>)} />
    </>
  );
}

function LineInspector({ element, onChange }: { element: Extract<PidsElement, { kind: 'line' }>; onChange: (patch: Partial<PidsElement>) => void }) {
  return (
    <>
      <PanelTitle title="Line Style" />
      <ColorInput label="Stroke" value={element.stroke} onChange={(stroke) => onChange({ stroke } as Partial<PidsElement>)} />
      <NumberInput label="Stroke Width" value={element.strokeWidth} onChange={(strokeWidth) => onChange({ strokeWidth } as Partial<PidsElement>)} />
    </>
  );
}

export function ValidationPanel({
  title,
  issues,
  selectedId,
  onSelect
}: {
  title: string;
  issues: ValidationIssue[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel-section validation-panel">
      <PanelTitle title={title} />
      {issues.length === 0 ? (
        <div className="valid-state">No issues found.</div>
      ) : (
        issues.slice(0, 20).map((issue) => (
          <button
            key={issue.id}
            className={`issue-row ${issue.severity} ${issue.target?.type === 'element' && issue.target.elementId === selectedId ? 'selected' : ''}`}
            onClick={() => issue.target?.type === 'element' && onSelect(issue.target.elementId)}
          >
            <span>{issue.code}</span>
            <p>{issue.message}</p>
          </button>
        ))
      )}
    </section>
  );
}

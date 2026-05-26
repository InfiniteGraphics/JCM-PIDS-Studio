import { normalizeColor } from '../canvas/rendering';

export function Tabs({
  items,
  active,
  onChange
}: {
  items: string[];
  active: string;
  onChange?: (item: string) => void;
}) {
  return (
    <div className="tabs">
      {items.map((item) => (
        <button key={item} type="button" className={item === active ? 'active' : ''} onClick={() => onChange?.(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

export function PanelTitle({ title }: { title: string }) {
  return <h3 className="panel-title">{title}</h3>;
}

export function ComponentButton({
  icon,
  label,
  hint,
  onClick
}: {
  icon: string;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="component-button" onClick={onClick} aria-label={label}>
      <span className="component-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      {hint && <small>{hint}</small>}
      <span className="drag-handle" aria-hidden="true">::</span>
    </button>
  );
}

export function TextInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  step = 0.5
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function ColorInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field color-field">
      <span>{label}</span>
      <input type="color" value={normalizeColor(value)} onChange={(event) => onChange(event.target.value)} />
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function Rulers({
  width,
  height,
  zoom,
  onCreateGuide
}: {
  width: number;
  height: number;
  zoom: number;
  onCreateGuide?: (axis: 'x' | 'y', value: number) => void;
}) {
  const rulerXOffset = 34;
  const rulerYOffset = 24;
  const xTicks = [0, 16, 32, 48, 64, 80, 96, 112, 128, width].filter((item, index, arr) => arr.indexOf(item) === index && item <= width);
  const yTicks = [0, 16, 32, 48, 64, height].filter((item, index, arr) => arr.indexOf(item) === index && item <= height);
  return (
    <>
      <div
        className="ruler ruler-x"
        style={{ left: `${rulerXOffset}px`, width: `calc(100% - ${rulerXOffset}px)` }}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const value = ((event.clientX - rect.left) / zoom);
          onCreateGuide?.('x', Math.max(0, Math.min(width, value)));
        }}
      >
        {xTicks.map((tick) => (
          <span key={tick} style={{ left: tick * zoom }}>
            {tick}
          </span>
        ))}
      </div>
      <div
        className="ruler ruler-y"
        style={{ top: `${rulerYOffset}px`, height: `calc(100% - ${rulerYOffset}px)` }}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const value = ((event.clientY - rect.top) / zoom);
          onCreateGuide?.('y', Math.max(0, Math.min(height, value)));
        }}
      >
        {yTicks.map((tick) => (
          <span key={tick} style={{ top: tick * zoom }}>
            {tick}
          </span>
        ))}
      </div>
    </>
  );
}

export function StatusNotice({
  tone,
  message
}: {
  tone: 'success' | 'error' | 'info';
  message: string;
}) {
  return <div className={`status-notice ${tone}`}>{message}</div>;
}

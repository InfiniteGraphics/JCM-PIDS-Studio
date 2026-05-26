import { normalizeColor } from '../canvas/rendering';

export function Tabs({ items, active }: { items: string[]; active: string }) {
  return (
    <div className="tabs">
      {items.map((item) => (
        <button key={item} className={item === active ? 'active' : ''}>
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
    <button className="component-button" onClick={onClick}>
      <span className="component-icon">{icon}</span>
      <span>{label}</span>
      {hint && <small>{hint}</small>}
      <span className="drag-handle">⋮⋮</span>
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
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" step="0.5" value={value} onChange={(event) => onChange(Number(event.target.value))} />
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

export function Rulers({ width, height, zoom }: { width: number; height: number; zoom: number }) {
  const xTicks = [0, 16, 32, 48, 64, 80, 96, 112, 128, width].filter((item, index, arr) => arr.indexOf(item) === index && item <= width);
  const yTicks = [0, 16, 32, 48, 64, height].filter((item, index, arr) => arr.indexOf(item) === index && item <= height);
  return (
    <>
      <div className="ruler ruler-x" style={{ width: width * zoom }}>
        {xTicks.map((tick) => (
          <span key={tick} style={{ left: tick * zoom }}>
            {tick}
          </span>
        ))}
      </div>
      <div className="ruler ruler-y" style={{ height: height * zoom }}>
        {yTicks.map((tick) => (
          <span key={tick} style={{ top: tick * zoom }}>
            {tick}
          </span>
        ))}
      </div>
    </>
  );
}

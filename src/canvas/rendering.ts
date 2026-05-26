import type { MockRuntime, PidsElement, PidsProject } from '../types';

export interface RenderedElement {
  key: string;
  element: PidsElement;
  x: number;
  y: number;
  rowIndex?: number;
}

export function getRenderedElements(project: PidsProject, runtime: MockRuntime): RenderedElement[] {
  const groupVisible = new Map(project.groups.map((group) => [group.id, group.visible]));
  const output: RenderedElement[] = [];
  const templateGroupId = 'rowTemplate';

  project.elements
    .filter((element) => element.visible && groupVisible.get(element.parentId ?? 'root') !== false && element.parentId !== templateGroupId)
    .sort((a, b) => a.z - b.z)
    .forEach((element) => {
      output.push({ key: element.id, element, x: element.x, y: element.y });
    });

  project.elements
    .filter((element) => element.visible && element.parentId === templateGroupId && element.repeat?.enabled)
    .sort((a, b) => a.z - b.z)
    .forEach((element) => {
      const repeat = element.repeat!;
      for (let rowIndex = 0; rowIndex < repeat.count; rowIndex += 1) {
        const hidden = runtime.hiddenRows.includes(rowIndex);
        if (project.behavior.respectHideArrival && hidden) continue;
        const customMessage = runtime.customMessages[rowIndex] || '';
        const arrival = runtime.arrivals[rowIndex] ?? null;
        if (!arrival && !customMessage) continue;
        const stepX = repeat.direction === 'horizontal' ? element.w + repeat.gap : 0;
        const stepY = repeat.direction === 'vertical' ? element.h + repeat.gap : 0;
        output.push({
          key: `${element.id}:${rowIndex}`,
          element,
          rowIndex,
          x: element.x + rowIndex * stepX,
          y: element.y + rowIndex * stepY
        });
      }
    });

  return output;
}

export function fitPreviewText(text: string, width: number, fontSize: number) {
  const maxChars = Math.max(3, Math.floor(width / Math.max(fontSize * 0.42, 1)));
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

export function normalizeColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff';
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number) {
  return Math.round(value * 2) / 2;
}

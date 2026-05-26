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

  project.elements
    .filter((element) => element.visible && groupVisible.get(element.parentId ?? 'root') !== false && element.parentId !== project.repeatRows.groupId)
    .sort((a, b) => a.z - b.z)
    .forEach((element) => {
      output.push({ key: element.id, element, x: element.x, y: element.y });
    });

  if (project.repeatRows.enabled && groupVisible.get(project.repeatRows.groupId) !== false) {
    const rowCount = project.repeatRows.countSource === 'pids.rows' ? Math.min(runtime.rows, project.repeatRows.maxRows) : project.repeatRows.maxRows;
    const templates = project.elements
      .filter((element) => element.visible && element.parentId === project.repeatRows.groupId)
      .sort((a, b) => a.z - b.z);

    let visibleRowIndex = 0;
    for (let i = 0; i < rowCount; i += 1) {
      const hidden = runtime.hiddenRows.includes(i);
      if (project.behavior.respectHideArrival && project.repeatRows.skipHiddenRows && hidden) continue;

      const customMessage = runtime.customMessages[i] || '';
      const arrival = runtime.arrivals[i] ?? null;
      if (!arrival && project.repeatRows.collapseEmptyRows && !customMessage) continue;

      const rowY = project.repeatRows.startY + visibleRowIndex * project.repeatRows.rowHeight;
      const replaceWithCustom = Boolean(customMessage && project.behavior.respectCustomMessage && project.repeatRows.customMessageMode === 'replace-row');

      templates.forEach((element) => {
        if (replaceWithCustom && element.condition !== 'customMessage') return;
        if (!replaceWithCustom) {
          if (element.condition === 'customMessage' && !(customMessage && project.repeatRows.customMessageMode === 'overlay')) return;
          if (element.condition === 'arrival' && !arrival && !project.repeatRows.showFallbackWhenEmpty) return;
          if (element.condition === 'platformVisible' && project.behavior.respectHidePlatformNumber && runtime.hidePlatformNumber) return;
          if (element.condition === 'platformVisible' && !arrival && !project.repeatRows.showFallbackWhenEmpty) return;
        }
        output.push({ key: `${element.id}:${i}`, element, rowIndex: i, x: element.x, y: rowY + element.y });
      });

      visibleRowIndex += 1;
    }
  }

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

import { useMemo, useState } from 'react';
import { getMockRuntime } from '../data/mockPids';
import { generateArtifacts, buildResourcePackManifest } from '../editor/codegen';
import { buildResourcePackZip } from '../editor/importExport';
import { checkJcmCompatibility, issueSummary, validateProject } from '../editor/validation';
import { createDefaultProject, uid } from '../editor/defaultProject';
import type {
  ElementCondition,
  MockScenario,
  PidsElement,
  PidsProject
} from '../types';

const STORAGE_KEY = 'js-pids-visual-editor-mvp-project-v3';

function loadInitialProject() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProject();
    return JSON.parse(raw) as PidsProject;
  } catch {
    return createDefaultProject();
  }
}

export function useEditorStore() {
  const [project, setProject] = useState<PidsProject>(() => loadInitialProject());
  const [selectedId, setSelectedId] = useState<string>('destination_template');
  const [scenario, setScenario] = useState<MockScenario>('normal');
  const [zoom, setZoom] = useState(4.5);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [history, setHistory] = useState<{ past: PidsProject[]; future: PidsProject[] }>({ past: [], future: [] });
  const [clipboard, setClipboard] = useState<PidsElement | null>(null);

  const runtime = useMemo(() => getMockRuntime(scenario), [scenario]);
  const selected = useMemo(() => project.elements.find((element) => element.id === selectedId) ?? null, [project.elements, selectedId]);
  const artifacts = useMemo(() => generateArtifacts(project), [project]);
  const manifest = useMemo(() => buildResourcePackManifest(project), [project]);
  const validationIssues = useMemo(() => validateProject(project), [project]);
  const compatibilityIssues = useMemo(() => checkJcmCompatibility(project, artifacts.script, manifest), [project, artifacts.script, manifest]);
  const exportIssues = useMemo(() => [...validationIssues, ...compatibilityIssues], [validationIssues, compatibilityIssues]);
  const exportSummary = useMemo(() => issueSummary(exportIssues), [exportIssues]);

  function commit(next: PidsProject) {
    setHistory((current) => ({ past: [...current.past, structuredClone(project)], future: [] }));
    setProject(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function updateProject(updater: (draft: PidsProject) => void) {
    const draft = structuredClone(project);
    updater(draft);
    commit(draft);
  }

  function setWholeProject(nextProject: PidsProject, nextSelectedId?: string) {
    commit(structuredClone(nextProject));
    setSelectedId(nextSelectedId ?? nextProject.elements[0]?.id ?? '');
  }

  function undo() {
    setHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (!previous) return current;
      const nextPast = current.past.slice(0, -1);
      const nextFuture = [structuredClone(project), ...current.future];
      setProject(previous);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(previous));
      return { past: nextPast, future: nextFuture };
    });
  }

  function redo() {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      const nextFuture = current.future.slice(1);
      const nextPast = [...current.past, structuredClone(project)];
      setProject(next);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return { past: nextPast, future: nextFuture };
    });
  }

  function resetProject() {
    const next = createDefaultProject();
    commit(next);
    setSelectedId('destination_template');
  }

  function newProject() {
    const next = createDefaultProject();
    commit(next);
    setSelectedId('destination_template');
    setScenario('normal');
    setZoom(4.5);
    setSnapToGrid(true);
  }

  function updateElement(id: string, patch: Partial<PidsElement>) {
    updateProject((draft) => {
      const index = draft.elements.findIndex((element) => element.id === id);
      if (index >= 0) {
        draft.elements[index] = { ...draft.elements[index], ...patch } as PidsElement;
      }
    });
  }

  function updateGroup(id: string, patch: Partial<PidsProject['groups'][number]>) {
    updateProject((draft) => {
      const group = draft.groups.find((item) => item.id === id);
      if (group) Object.assign(group, patch);
    });
  }

  function copySelectedElement() {
    const source = project.elements.find((element) => element.id === selectedId);
    if (!source) return false;
    setClipboard(structuredClone(source));
    return true;
  }

  function pasteElement() {
    const source = clipboard;
    if (!source) return null;

    const clone = {
      ...structuredClone(source),
      id: uid(source.kind),
      name: `${source.name} Copy`,
      x: source.x + 2,
      y: source.y + 2,
      z: Math.max(0, ...project.elements.filter((element) => element.parentId === source.parentId).map((element) => element.z)) + 1
    } as PidsElement;

    updateProject((draft) => {
      draft.elements.push(clone);
      const group = draft.groups.find((item) => item.id === clone.parentId);
      if (group && !group.children.includes(clone.id)) {
        group.children.push(clone.id);
      }
    });
    setSelectedId(clone.id);
    return clone.id;
  }

  function addComponent(kind: 'text' | 'rect' | 'circle' | 'line', parentId = selected?.parentId === 'rowTemplate' ? 'rowTemplate' : 'root') {
    const base = {
      id: uid(kind),
      name:
        kind === 'text'
          ? 'New Text'
          : kind === 'circle'
            ? 'New Route Chip'
            : kind === 'line'
              ? 'New Line'
              : 'New Texture',
      visible: true,
      parentId,
      x: parentId === 'rowTemplate' ? 28 : 12,
      y: parentId === 'rowTemplate' ? 0 : 12,
      w: kind === 'circle' ? 9 : kind === 'line' ? 24 : 32,
      h: kind === 'circle' ? 9 : kind === 'line' ? 0 : 8,
      z: Math.max(0, ...project.elements.map((element) => element.z)) + 1,
      condition: (parentId === 'rowTemplate' ? 'arrival' : 'always') as ElementCondition
    };

    const element: PidsElement =
      kind === 'text'
        ? {
            ...base,
            kind: 'text',
            text: parentId === 'rowTemplate' ? 'New Row Text' : 'New Text',
            binding: parentId === 'rowTemplate' ? 'arrival.destination()' : 'static',
            color: '#ffffff',
            fontSize: 5,
            fontWeight: 'bold',
            align: 'left',
            overflow: 'none',
            fallback: '--',
            font: 'mtr:mtr'
          }
        : kind === 'circle'
          ? {
              ...base,
              kind: 'circle',
              fill: '#1769d7',
              stroke: '#ffffff',
              text: 'A',
              textColor: '#ffffff',
              binding: parentId === 'rowTemplate' ? 'arrival.routeNumber()' : 'static',
              textureId: 'jsblock:textures/block/pids/circle.png'
            }
          : kind === 'line'
            ? {
                ...base,
                kind: 'line',
                stroke: '#ffd32a',
                strokeWidth: 0.8
              }
            : {
                ...base,
                kind: 'rect',
                fill: '#1b2d4a',
                stroke: '#55708f',
                radius: 1,
                textureId: 'jsblock:textures/block/pids/pixel.png'
              };

    updateProject((draft) => {
      draft.elements.push(element);
      const group = draft.groups.find((item) => item.id === element.parentId);
      group?.children.push(element.id);
    });
    setSelectedId(element.id);
  }

  function deleteElement(targetId: string) {
    const remaining = project.elements.filter((element) => element.id !== targetId);
    updateProject((draft) => {
      draft.elements = draft.elements.filter((element) => element.id !== targetId);
      draft.groups.forEach((group) => {
        group.children = group.children.filter((id) => id !== targetId);
      });
    });
    setSelectedId(remaining[0]?.id ?? '');
  }

  function duplicateElement(elementId: string) {
    const source = project.elements.find((element) => element.id === elementId);
    if (!source) return;
    setClipboard(structuredClone(source));
    const clone = {
      ...structuredClone(source),
      id: uid(source.kind),
      name: `${source.name} Copy`,
      x: source.x + 2,
      y: source.y + 2,
      z: source.z + 1
    } as PidsElement;

    updateProject((draft) => {
      draft.elements.push(clone);
      const group = draft.groups.find((item) => item.id === clone.parentId);
      group?.children.push(clone.id);
    });
    setSelectedId(clone.id);
  }

  function reorderZ(id: string, direction: -1 | 1) {
    updateProject((draft) => {
      const element = draft.elements.find((item) => item.id === id);
      if (!element) return;
      element.z += direction;
      draft.elements
        .sort((a, b) => a.z - b.z)
        .forEach((item, index) => {
          item.z = index;
        });
    });
  }

  function moveLayer(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    updateProject((draft) => {
      const drag = draft.elements.find((item) => item.id === dragId);
      const target = draft.elements.find((item) => item.id === targetId);
      if (!drag || !target || drag.parentId !== target.parentId) return;
      const siblings = draft.elements.filter((item) => item.parentId === drag.parentId).sort((a, b) => a.z - b.z);
      const from = siblings.findIndex((item) => item.id === dragId);
      const to = siblings.findIndex((item) => item.id === targetId);
      const [item] = siblings.splice(from, 1);
      siblings.splice(to, 0, item);
      siblings.forEach((entry, index) => {
        entry.z = index;
      });
      const group = draft.groups.find((item) => item.id === drag.parentId);
      if (group) group.children = siblings.map((item) => item.id);
    });
  }

  async function exportZip() {
    return buildResourcePackZip(project);
  }

  return {
    project,
    selectedId,
    selected,
    scenario,
    zoom,
    snapToGrid,
    runtime,
    artifacts,
    manifest,
    validationIssues,
    compatibilityIssues,
    exportIssues,
    exportSummary,
    history,
    clipboard,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    canPaste: clipboard !== null,
    setSelectedId,
    setScenario,
    setZoom,
    setSnapToGrid,
    setWholeProject,
    updateProject,
    updateElement,
    updateGroup,
    addComponent,
    deleteElement,
    duplicateElement,
    copySelectedElement,
    pasteElement,
    reorderZ,
    moveLayer,
    undo,
    redo,
    newProject,
    resetProject,
    exportZip
  };
}

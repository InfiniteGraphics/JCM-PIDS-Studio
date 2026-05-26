import { createDefaultProject } from '../editor/defaultProject';
import type { PidsElement, PidsProject, ProjectImportResult, TextureAsset, TextureElement } from '../types';

export const CURRENT_SCHEMA_VERSION = 3 as const;

const RESOURCE_NAMESPACE_PATTERN = /^[a-z0-9_.-]+$/;
const METADATA_PREFIX = '@js-pids-editor-project:';

type LegacyProjectV2 = Omit<PidsProject, 'schemaVersion' | 'assets'> & {
  schemaVersion: 2;
  assets?: TextureAsset[];
};

export function parseProjectJson(text: string): PidsProject {
  const parsed = JSON.parse(text) as unknown;
  return migrateProject(parsed);
}

export function migrateProject(input: unknown): PidsProject {
  if (!input || typeof input !== 'object') {
    throw new Error('Project JSON must be an object.');
  }

  const candidate = input as Record<string, unknown>;
  const schemaVersion = candidate.schemaVersion;
  if (typeof schemaVersion !== 'number') {
    throw new Error('Project JSON is missing schemaVersion.');
  }
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion ${schemaVersion}. Current editor supports up to ${CURRENT_SCHEMA_VERSION}.`);
  }
  if (schemaVersion === CURRENT_SCHEMA_VERSION) {
    const project = candidate as unknown as PidsProject;
    validateProjectShape(project);
    return normalizeProject(project);
  }

  if (schemaVersion === 2) {
    return migrateV2Project(candidate);
  }

  throw new Error(`Unsupported schemaVersion ${schemaVersion}. Automatic migration is only defined for version 2 and ${CURRENT_SCHEMA_VERSION}.`);
}

export function importEmbeddedProjectMetadata(text: string): PidsProject {
  const encoded = extractEmbeddedMetadata(text);
  if (!encoded) throw new Error('Generated JS does not contain embedded project metadata.');

  const decoded = decodeBase64Utf8(encoded);
  return parseProjectJson(decoded);
}

export function importJsonLikeText(text: string): ProjectImportResult {
  const trimmed = text.trim();

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.schemaVersion === 'number') {
      return { source: 'project-json', project: migrateProject(parsed) };
    }

    if (Array.isArray(parsed.pids_images)) {
      return { source: 'resource-shell', project: createProjectShellFromResourceJson(parsed) };
    }
  }

  if (trimmed.includes(METADATA_PREFIX)) {
    return { source: 'embedded-js-metadata', project: importEmbeddedProjectMetadata(trimmed) };
  }

  throw new Error('Unsupported file. Import a project JSON, generated JS with embedded metadata, or joban_custom_resources.json.');
}

export function normalizeResourceNamespace(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeScriptPath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/').trim();
  return normalized;
}

export function assertValidResourceNamespace(value: string) {
  if (!RESOURCE_NAMESPACE_PATTERN.test(value)) {
    throw new Error('resourceNamespace should contain only lowercase letters, numbers, underscore, dash, or dot.');
  }
}

export function assertValidScriptPath(value: string) {
  if (!value.endsWith('.js')) {
    throw new Error('scriptPath should point to a .js file.');
  }
  if (!value || value.startsWith('/') || /^[a-zA-Z]:/.test(value)) {
    throw new Error('scriptPath must be a relative resource-pack path.');
  }
  if (value.split('/').some((segment) => segment === '..' || segment === '.')) {
    throw new Error('scriptPath cannot contain . or .. segments.');
  }
}

export function buildScriptResourceId(namespace: string, scriptPath: string) {
  return `${namespace}:${scriptPath}`;
}

export function buildScriptZipPath(namespace: string, scriptPath: string) {
  return `assets/${namespace}/${scriptPath}`;
}

export function buildProjectMetadataPath() {
  return 'js-pids-editor.project.json';
}

export function extractEmbeddedMetadata(text: string): string | null {
  const match = text.match(/@js-pids-editor-project:([A-Za-z0-9+/=]+)/);
  return match?.[1] ?? null;
}

function createProjectShellFromResourceJson(parsed: Record<string, unknown>): PidsProject {
  const project = createDefaultProject();
  const firstEntry = Array.isArray(parsed.pids_images) ? (parsed.pids_images[0] as Record<string, unknown> | undefined) : undefined;
  if (!firstEntry) return project;

  if (typeof firstEntry.name === 'string' && firstEntry.name.trim()) {
    project.name = firstEntry.name;
  } else if (typeof firstEntry.id === 'string' && firstEntry.id.trim()) {
    project.name = firstEntry.id;
  }

  const scriptFiles = Array.isArray(firstEntry.scriptFiles) ? firstEntry.scriptFiles : [];
  const scriptFile = typeof scriptFiles[0] === 'string' ? scriptFiles[0] : '';
  if (scriptFile.includes(':')) {
    const [namespace, path] = scriptFile.split(':');
    project.resourceNamespace = normalizeResourceNamespace(namespace || project.resourceNamespace);
    project.scriptPath = normalizeScriptPath(path || project.scriptPath);
  }

  return normalizeProject(project);
}

function normalizeProject(project: PidsProject): PidsProject {
  const defaults = createDefaultProject();
  const clone = structuredClone(project);
  clone.schemaVersion = CURRENT_SCHEMA_VERSION;
  clone.resourceNamespace = normalizeResourceNamespace(clone.resourceNamespace);
  clone.scriptPath = normalizeScriptPath(clone.scriptPath);

  assertValidResourceNamespace(clone.resourceNamespace);
  assertValidScriptPath(clone.scriptPath);

  clone.groups = clone.groups.map((group) => ({
    ...group,
    expanded: group.expanded ?? true
  }));

  clone.canvas = {
    width: normalizeNumber(clone.canvas?.width, defaults.canvas.width, 1),
    height: normalizeNumber(clone.canvas?.height, defaults.canvas.height, 1)
  };
  clone.repeatRows = {
    ...defaults.repeatRows,
    ...clone.repeatRows,
    startX: normalizeNumber(clone.repeatRows?.startX, defaults.repeatRows.startX),
    startY: normalizeNumber(clone.repeatRows?.startY, defaults.repeatRows.startY),
    rowWidth: normalizeNumber(clone.repeatRows?.rowWidth, defaults.repeatRows.rowWidth, 0.5),
    rowHeight: normalizeNumber(clone.repeatRows?.rowHeight, defaults.repeatRows.rowHeight, 0.5),
    direction: clone.repeatRows?.direction === 'horizontal' ? 'horizontal' : 'vertical',
    gap: normalizeNumber(clone.repeatRows?.gap, defaults.repeatRows.gap, 0),
    maxRows: normalizeNumber(clone.repeatRows?.maxRows, defaults.repeatRows.maxRows, 1),
    countSource: clone.repeatRows?.countSource === 'fixed' ? 'fixed' : 'pids.rows'
  };
  clone.behavior = {
    ...defaults.behavior,
    ...clone.behavior,
    zOrderStep: normalizeNumber(clone.behavior?.zOrderStep, defaults.behavior.zOrderStep, 0.001)
  };
  clone.assets = Array.isArray(clone.assets)
    ? clone.assets.map((asset) => normalizeAsset(asset, clone.resourceNamespace))
    : [];
  clone.guides = Array.isArray(clone.guides)
    ? clone.guides
        .filter((guide) => guide && (guide.axis === 'x' || guide.axis === 'y'))
        .map((guide, index) => ({
          id: typeof guide.id === 'string' && guide.id ? guide.id : `guide_${index + 1}`,
          axis: guide.axis,
          value: normalizeNumber(guide.value, 0, 0)
        }))
    : [];
  clone.elements = clone.elements.map((element) => normalizeElement(element, defaults));
  clone.groups = normalizeGroups(clone, defaults);

  return clone;
}

function normalizeElement(element: PidsElement, defaults: PidsProject): PidsElement {
  const clone = structuredClone(element);
  clone.visible = Boolean(clone.visible);
  clone.parentId = clone.parentId ?? 'root';
  const defaultElement = defaults.elements.find((item) => item.id === clone.id);
  clone.x = normalizeNumber(clone.x, defaultElement?.x ?? 0);
  clone.y = normalizeNumber(clone.y, defaultElement?.y ?? 0);
  clone.w = normalizeNumber(clone.w, defaultElement?.w ?? 1, 0.5);
  clone.h = normalizeNumber(clone.h, defaultElement?.h ?? 1, 0.5);
  clone.z = normalizeNumber(clone.z, defaultElement?.z ?? 0);
  if (clone.kind === 'texture') {
    clone.textureId = clone.textureId.trim();
    clone.tint = clone.tint || '#ffffff';
    clone.opacity = normalizeOptionalNumber(clone.opacity, defaultElement?.kind === 'texture' ? defaultElement.opacity : 1, 0);
    clone.uv = normalizeOptionalUv(clone.uv);
  }
  if (clone.kind === 'text') {
    clone.fontSize = normalizeNumber(clone.fontSize, defaultElement?.kind === 'text' ? defaultElement.fontSize : 5, 0.1);
    clone.rowIndex = normalizeOptionalNumber(clone.rowIndex, defaultElement?.kind === 'text' ? defaultElement.rowIndex : 0, 0);
    clone.marqueeDuration = normalizeOptionalNumber(
      clone.marqueeDuration,
      defaultElement?.kind === 'text' ? defaultElement.marqueeDuration : undefined,
      0.1
    );
  }
  if (clone.kind === 'rect') {
    clone.opacity = normalizeOptionalNumber(clone.opacity, defaultElement?.kind === 'rect' ? defaultElement.opacity : 1, 0);
    clone.radius = normalizeOptionalNumber(clone.radius, defaultElement?.kind === 'rect' ? defaultElement.radius : 0, 0);
    clone.uv = normalizeOptionalUv(clone.uv);
  }
  if (clone.kind === 'line') {
    clone.strokeWidth = normalizeNumber(clone.strokeWidth, defaultElement?.kind === 'line' ? defaultElement.strokeWidth : 1, 0.1);
  }
  if (clone.kind === 'circle') {
    clone.rowIndex = normalizeOptionalNumber(clone.rowIndex, defaultElement?.kind === 'circle' ? defaultElement.rowIndex : 0, 0);
  }
  if (clone.parentId === 'rowTemplate' && !clone.repeat) {
    clone.repeat = {
      enabled: true,
      count: 4,
      direction: 'vertical',
      gap: 0
    };
  }
  return clone;
}

function validateProjectShape(project: PidsProject) {
  if (!project.name || typeof project.name !== 'string') throw new Error('Project name is required.');
  if (!project.preset || typeof project.preset !== 'string') throw new Error('Project preset is required.');
  if (!Array.isArray(project.groups)) throw new Error('Project groups must be an array.');
  if (!Array.isArray(project.elements)) throw new Error('Project elements must be an array.');
  if (!project.canvas || typeof project.canvas.width !== 'number' || typeof project.canvas.height !== 'number') {
    throw new Error('Project canvas is invalid.');
  }
  if (!Array.isArray(project.assets)) throw new Error('Project assets must be an array.');
  if (!project.repeatRows || typeof project.repeatRows.groupId !== 'string') throw new Error('Project repeatRows is invalid.');
  if (!project.behavior) throw new Error('Project behavior is invalid.');
}

function migrateV2Project(candidate: Record<string, unknown>): PidsProject {
  const legacy = structuredClone(candidate) as Record<string, unknown>;
  const project = legacy as unknown as LegacyProjectV2;
  validateLegacyV2Shape(project);

  const next = createDefaultProject();
  next.name = project.name;
  next.preset = project.preset;
  next.resourceNamespace = project.resourceNamespace;
  next.scriptPath = project.scriptPath;
  next.canvas = structuredClone(project.canvas);
  next.groups = structuredClone(project.groups);
  next.repeatRows = structuredClone(project.repeatRows);
  next.behavior = structuredClone(project.behavior);
  next.assets = [];
  next.elements = project.elements.map((element) => migrateElementFromV2(element as unknown as Record<string, unknown>));
  return normalizeProject(next);
}

function validateLegacyV2Shape(project: LegacyProjectV2) {
  if (!project.name || typeof project.name !== 'string') throw new Error('Project name is required.');
  if (!project.preset || typeof project.preset !== 'string') throw new Error('Project preset is required.');
  if (!Array.isArray(project.groups)) throw new Error('Project groups must be an array.');
  if (!Array.isArray(project.elements)) throw new Error('Project elements must be an array.');
  if (!project.canvas || typeof project.canvas.width !== 'number' || typeof project.canvas.height !== 'number') {
    throw new Error('Project canvas is invalid.');
  }
  if (!project.repeatRows || typeof project.repeatRows.groupId !== 'string') throw new Error('Project repeatRows is invalid.');
  if (!project.behavior) throw new Error('Project behavior is invalid.');
}

function migrateElementFromV2(raw: Record<string, unknown>): PidsElement {
  if (raw.kind === 'rect' && typeof raw.textureId === 'string' && raw.textureId.trim() && raw.textureId !== 'jsblock:textures/block/pids/pixel.png') {
    const migrated: TextureElement = {
      id: String(raw.id),
      kind: 'texture',
      name: String(raw.name),
      visible: Boolean(raw.visible),
      locked: Boolean(raw.locked),
      parentId: typeof raw.parentId === 'string' ? raw.parentId : 'root',
      x: Number(raw.x),
      y: Number(raw.y),
      w: Number(raw.w),
      h: Number(raw.h),
      z: Number(raw.z),
      condition: raw.condition as TextureElement['condition'],
      textureId: String(raw.textureId),
      opacity: typeof raw.opacity === 'number' ? raw.opacity : 1,
      uv: Array.isArray(raw.uv) ? raw.uv as [number, number, number, number] : undefined,
      tint: '#ffffff'
    };
    return migrated;
  }

  const clone = structuredClone(raw) as unknown as PidsElement;
  if (clone.kind === 'rect' && 'textureId' in clone) {
    delete (clone as PidsElement & { textureId?: string }).textureId;
  }
  return clone;
}

function normalizeAsset(asset: TextureAsset, namespace: string): TextureAsset {
  const clone = structuredClone(asset);
  clone.textureId = clone.textureId.trim();
  clone.zipPath = clone.zipPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clone.textureId.includes(':')) {
    clone.textureId = `${namespace}:${clone.textureId}`;
  }
  return clone;
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeNumber(value: unknown, fallback: number, min?: number) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  if (typeof min === 'number' && value < min) {
    return min;
  }
  return value;
}

function normalizeOptionalNumber(value: unknown, fallback?: number, min?: number) {
  if (value == null) return fallback;
  return normalizeNumber(value, fallback ?? 0, min);
}

function normalizeOptionalUv(value: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const normalized = value.map((entry) => normalizeNumber(entry, 0));
  return [normalized[0], normalized[1], normalized[2], normalized[3]];
}

function normalizeGroups(project: PidsProject, defaults: PidsProject) {
  const repeatGroupId = project.repeatRows.groupId;
  const groups = project.groups.filter((group) => typeof group.id === 'string' && group.id);
  const repeatGroup =
    groups.find((group) => group.id === repeatGroupId) ??
    defaults.groups.find((group) => group.id === repeatGroupId) ?? {
      id: repeatGroupId,
      name: 'Repeat Rows Template',
      visible: true,
      expanded: true,
      children: []
    };

  const normalGroups = groups.filter((group) => group.id !== repeatGroupId);
  const fallbackGroup = normalGroups[0] ?? defaults.groups.find((group) => group.id === 'root') ?? {
    id: 'root',
    name: 'Layer 1',
    visible: true,
    expanded: true,
    children: []
  };

  project.elements = project.elements.map((element) => {
    if (element.parentId === repeatGroupId) return element;
    const matchedGroup = normalGroups.find((group) => group.id === element.parentId);
    return matchedGroup ? element : { ...element, parentId: fallbackGroup.id };
  });

  const childMap = new Map<string, string[]>();
  [...normalGroups, repeatGroup].forEach((group) => {
    childMap.set(group.id, []);
  });
  project.elements.forEach((element) => {
    const groupId = element.parentId ?? fallbackGroup.id;
    const list = childMap.get(groupId);
    if (list) list.push(element.id);
  });

  const dedupedNormalGroups = (normalGroups.length > 0 ? normalGroups : [fallbackGroup]).map((group, index) => ({
    ...group,
    name: group.name?.trim() || `Layer ${index + 1}`,
    visible: group.visible !== false,
    expanded: group.expanded ?? true,
    children: childMap.get(group.id) ?? []
  }));

  return [
    ...dedupedNormalGroups,
    {
      ...repeatGroup,
      name: repeatGroup.name?.trim() || 'Repeat Rows Template',
      visible: repeatGroup.visible !== false,
      expanded: repeatGroup.expanded ?? true,
      children: childMap.get(repeatGroup.id) ?? []
    }
  ];
}

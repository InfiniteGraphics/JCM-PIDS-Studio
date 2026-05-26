import { createDefaultProject } from '../editor/defaultProject';
import type { PidsElement, PidsProject, ProjectImportResult } from '../types';

export const CURRENT_SCHEMA_VERSION = 2 as const;

const RESOURCE_NAMESPACE_PATTERN = /^[a-z0-9_.-]+$/;
const METADATA_PREFIX = '@js-pids-editor-project:';

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
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion ${schemaVersion}. Automatic migration is only defined for version ${CURRENT_SCHEMA_VERSION}.`);
  }

  const project = candidate as unknown as PidsProject;
  validateProjectShape(project);

  return normalizeProject(project);
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

  clone.elements = clone.elements.map(normalizeElement);

  return clone;
}

function normalizeElement(element: PidsElement): PidsElement {
  const clone = structuredClone(element);
  clone.visible = Boolean(clone.visible);
  clone.parentId = clone.parentId ?? 'root';
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
  if (!project.repeatRows || typeof project.repeatRows.groupId !== 'string') throw new Error('Project repeatRows is invalid.');
  if (!project.behavior) throw new Error('Project behavior is invalid.');
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

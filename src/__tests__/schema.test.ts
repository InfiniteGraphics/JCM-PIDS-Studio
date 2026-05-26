import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../editor/defaultProject';
import {
  assertValidScriptPath,
  buildScriptResourceId,
  buildScriptZipPath,
  importEmbeddedProjectMetadata,
  migrateProject,
  parseProjectJson
} from '../schema/projectSchema';
import { generatePidsScript } from '../editor/codegen';
import { DEFAULT_CANVAS_ZOOM, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from '../store/editorStore';

describe('project schema', () => {
  it('parses a current project json', () => {
    const project = createDefaultProject();
    const parsed = parseProjectJson(JSON.stringify(project));
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.scriptPath).toBe('scripts/pids/custom_pids.js');
  });

  it('rejects unsupported future schema versions', () => {
    const project = createDefaultProject();
    expect(() => migrateProject({ ...project, schemaVersion: 999 })).toThrow(/Unsupported schemaVersion/);
  });

  it('rejects unsafe script paths', () => {
    expect(() => assertValidScriptPath('../evil.js')).toThrow(/cannot contain/);
  });

  it('builds resource ids and zip paths consistently', () => {
    expect(buildScriptResourceId('jsblock', 'scripts/a.js')).toBe('jsblock:scripts/a.js');
    expect(buildScriptZipPath('jsblock', 'scripts/a.js')).toBe('assets/jsblock/scripts/a.js');
  });

  it('restores embedded metadata from generated js', () => {
    const project = createDefaultProject();
    const script = generatePidsScript(project);
    const restored = importEmbeddedProjectMetadata(script);
    expect(restored.name).toBe(project.name);
    expect(restored.elements.length).toBe(project.elements.length);
  });

  it('uses the updated canvas zoom defaults', () => {
    expect(DEFAULT_CANVAS_ZOOM).toBe(8);
    expect(MIN_CANVAS_ZOOM).toBeLessThan(DEFAULT_CANVAS_ZOOM);
    expect(MAX_CANVAS_ZOOM).toBeGreaterThan(DEFAULT_CANVAS_ZOOM);
  });
});

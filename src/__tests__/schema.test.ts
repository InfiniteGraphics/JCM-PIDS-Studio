import { describe, expect, it } from 'vitest';
import { createDefaultProject, createDemoProject } from '../editor/defaultProject';
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
    expect(parsed.groups.filter((group) => group.id !== parsed.repeatRows.groupId)).toHaveLength(1);
    expect(parsed.elements).toHaveLength(0);
    expect(parsed.repeatRows.direction).toBe('vertical');
    expect(parsed.repeatRows.gap).toBe(0);
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
    const project = createDemoProject();
    const script = generatePidsScript(project);
    const restored = importEmbeddedProjectMetadata(script);
    expect(restored.name).toBe(project.name);
    expect(restored.elements.length).toBe(project.elements.length);
  });

  it('normalizes invalid numeric fields from stored projects', () => {
    const project = createDemoProject();
    const restored = migrateProject({
      ...project,
      guides: [{ id: '', axis: 'x', value: null }],
      elements: project.elements.map((element) =>
        element.id === 'destination_template'
          ? { ...element, y: null, w: null, fontSize: null }
          : element
      )
    });
    const target = restored.elements.find((element) => element.id === 'destination_template');
    expect(target?.y).toBe(0);
    expect(target?.w).toBe(1);
    expect(target?.kind === 'text' ? target.fontSize : undefined).toBe(5);
    expect(restored.guides[0]).toEqual({ id: 'guide_1', axis: 'x', value: 0 });
  });

  it('merges legacy global groups into editable layers', () => {
    const project = createDemoProject();
    const restored = migrateProject({
      ...project,
      groups: [
        { id: 'root', name: 'Root', visible: true, children: ['bg'] },
        { id: 'header', name: 'Header', visible: true, children: ['header_bg', 'station_title'] },
        { id: 'rowTemplate', name: 'Arrival Rows Template', visible: true, children: project.groups.find((group) => group.id === 'rowTemplate')?.children ?? [] },
        { id: 'footer', name: 'Footer', visible: true, children: ['footer_left', 'footer_right'] }
      ],
      elements: project.elements.map((element) => {
        if (['header_bg', 'station_title'].includes(element.id)) return { ...element, parentId: 'header' };
        if (['footer_left', 'footer_right'].includes(element.id)) return { ...element, parentId: 'footer' };
        return element;
      })
    });

    expect(restored.groups.filter((group) => group.id !== restored.repeatRows.groupId)).toHaveLength(3);
    expect(restored.elements.find((element) => element.id === 'header_bg')?.parentId).toBe('header');
    expect(restored.elements.find((element) => element.id === 'footer_left')?.parentId).toBe('footer');
  });

  it('uses the updated canvas zoom defaults', () => {
    expect(DEFAULT_CANVAS_ZOOM).toBe(8);
    expect(MIN_CANVAS_ZOOM).toBeLessThan(DEFAULT_CANVAS_ZOOM);
    expect(MAX_CANVAS_ZOOM).toBeGreaterThan(DEFAULT_CANVAS_ZOOM);
  });
});

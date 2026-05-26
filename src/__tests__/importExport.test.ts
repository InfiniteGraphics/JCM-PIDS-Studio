import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../editor/defaultProject';
import { buildResourcePackZip, importProjectText } from '../editor/importExport';
import { generatePidsScript } from '../editor/codegen';

describe('import/export', () => {
  it('imports project json', () => {
    const project = createDefaultProject();
    const result = importProjectText(JSON.stringify(project));
    expect(result.source).toBe('project-json');
    expect(result.project.repeatRows.groupId).toBe('rowTemplate');
  });

  it('imports embedded metadata js', () => {
    const project = createDefaultProject();
    const script = generatePidsScript(project);
    const result = importProjectText(script);
    expect(result.source).toBe('embedded-js-metadata');
    expect(result.project.name).toBe(project.name);
  });

  it('builds resource pack zip and manifest', async () => {
    const project = createDefaultProject();
    const result = await buildResourcePackZip(project);
    expect(result.manifest.files).toContain('joban_custom_resources.json');
    expect(result.manifest.files).toContain('js-pids-editor.project.json');
    expect(result.manifest.scriptZipPath).toBe('assets/jsblock/scripts/pids/custom_pids.js');
    expect(result.blob.size).toBeGreaterThan(0);
  });
});

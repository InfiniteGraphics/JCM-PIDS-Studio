import { describe, expect, it } from 'vitest';
import { createDefaultProject, createDemoProject } from '../editor/defaultProject';
import { buildResourcePackZip, importProjectText } from '../editor/importExport';
import { generatePidsScript } from '../editor/codegen';
import sampleProject from '../../examples/sample-pids-project.json';

describe('import/export', () => {
  it('imports project json', () => {
    const project = createDefaultProject();
    const result = importProjectText(JSON.stringify(project));
    expect(result.source).toBe('project-json');
    expect(result.project.repeatRows.groupId).toBe('rowTemplate');
  });

  it('imports embedded metadata js', () => {
    const project = createDemoProject();
    const script = generatePidsScript(project);
    const result = importProjectText(script);
    expect(result.source).toBe('embedded-js-metadata');
    expect(result.project.name).toBe(project.name);
  });

  it('imports resource json shell with script mapping', () => {
    const result = importProjectText(JSON.stringify({
      pids_images: [
        {
          id: 'demo_shell',
          name: 'Demo Shell',
          scriptFiles: ['demo_namespace:scripts/demo.js']
        }
      ]
    }));

    expect(result.source).toBe('resource-shell');
    expect(result.project.name).toBe('Demo Shell');
    expect(result.project.resourceNamespace).toBe('demo_namespace');
    expect(result.project.scriptPath).toBe('scripts/demo.js');
  });

  it('imports the bundled sample project file', () => {
    const result = importProjectText(JSON.stringify(sampleProject));
    expect(result.source).toBe('project-json');
    expect(result.project.name).toBe('Sample PIDS Layout');
    expect(result.project.elements.length).toBeGreaterThan(0);
  });

  it('builds resource pack zip and manifest', async () => {
    const project = createDemoProject();
    project.assets.push({
      id: 'asset_logo',
      name: 'logo',
      textureId: 'jsblock:textures/imported/logo.png',
      zipPath: 'assets/jsblock/textures/imported/logo.png',
      mimeType: 'image/png',
      dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      width: 1,
      height: 1
    });
    const result = await buildResourcePackZip(project);
    expect(result.manifest.files).toContain('joban_custom_resources.json');
    expect(result.manifest.files).toContain('js-pids-editor.project.json');
    expect(result.manifest.files).toContain('assets/jsblock/textures/imported/logo.png');
    expect(result.manifest.scriptZipPath).toBe('assets/jsblock/scripts/pids/custom_pids.js');
    expect(result.blob.size).toBeGreaterThan(0);
  });
});

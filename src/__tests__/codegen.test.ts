import { describe, expect, it } from 'vitest';
import { createDefaultProject, createDemoProject } from '../editor/defaultProject';
import { generatePidsScript, generateResourceJson } from '../editor/codegen';

describe('codegen', () => {
  it('generates a stable default project script', () => {
    const project = createDefaultProject();
    const script = generatePidsScript(project);

    expect(script).toContain('function create(ctx, state, pids)');
    expect(script).toContain('function render(ctx, state, pids)');
    expect(script).toContain('function dispose(ctx, state, pids)');
    expect(script).toContain('@js-pids-editor-project:');
    expect(script).toContain('drawRows(ctx, state, pids');
  });

  it('generates resource json with matching scriptFiles', () => {
    const project = createDefaultProject();
    const json = generateResourceJson(project);
    expect(json).toContain('"scriptFiles"');
    expect(json).toContain('jsblock:scripts/pids/custom_pids.js');
  });

  it('generates horizontal repeat rows when configured per element', () => {
    const project = createDemoProject();
    const repeated = project.elements.find((element) => element.id === 'destination_template');
    if (!repeated || repeated.kind !== 'text') throw new Error('destination_template is missing');
    repeated.repeat = {
      enabled: true,
      count: 4,
      direction: 'horizontal',
      gap: 3
    };
    const script = generatePidsScript(project);

    expect(script).toContain('const rowX = 28 + i * 57');
    expect(script).toContain('const rowY = 0 + i * 0');
  });
});

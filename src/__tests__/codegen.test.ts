import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../editor/defaultProject';
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
});

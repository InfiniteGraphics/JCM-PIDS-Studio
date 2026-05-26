import { describe, expect, it } from 'vitest';
import { createDefaultProject, createDemoProject } from '../editor/defaultProject';
import { checkJcmCompatibility, validateProject } from '../editor/validation';
import { buildResourcePackManifest, generatePidsScript } from '../editor/codegen';

describe('validation', () => {
  it('reports invalid namespace and script path', () => {
    const project = createDefaultProject();
    project.resourceNamespace = 'BAD Namespace';
    project.scriptPath = '../hack.js';
    const issues = validateProject(project);

    expect(issues.some((issue) => issue.code === 'INVALID_RESOURCE_NAMESPACE')).toBe(true);
    expect(issues.some((issue) => issue.code === 'INVALID_SCRIPT_PATH')).toBe(true);
  });

  it('reports duplicate ids and missing parent groups', () => {
    const project = createDemoProject();
    project.elements[1].id = project.elements[0].id;
    project.elements[1].parentId = 'missing-group';
    const issues = validateProject(project);

    expect(issues.some((issue) => issue.code === 'DUPLICATE_ELEMENT_ID')).toBe(true);
    expect(issues.some((issue) => issue.code === 'MISSING_PARENT_GROUP')).toBe(true);
  });

  it('flags non-orthogonal lines for compatibility', () => {
    const project = createDemoProject();
    project.elements.push({
      id: 'diag',
      kind: 'line',
      name: 'Diagonal',
      visible: true,
      parentId: 'root',
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      z: 99,
      stroke: '#ffffff',
      strokeWidth: 1
    });

    const issues = checkJcmCompatibility(project, generatePidsScript(project), buildResourcePackManifest(project));
    expect(issues.some((issue) => issue.code === 'LINE_ROTATION_UNVERIFIED')).toBe(true);
  });

  it('does not treat plain JavaScript helpers as unsupported JCM API calls', () => {
    const project = createDemoProject();
    const issues = checkJcmCompatibility(project, generatePidsScript(project), buildResourcePackManifest(project));

    expect(issues.some((issue) => issue.code === 'JCM_API_NOT_ALLOWED')).toBe(false);
  });
});

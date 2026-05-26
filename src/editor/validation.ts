import {
  assertValidResourceNamespace,
  assertValidScriptPath,
  buildScriptResourceId,
  buildScriptZipPath
} from '../schema/projectSchema';
import type {
  JcmCompatibilityIssue,
  PidsElement,
  PidsProject,
  ResourcePackManifest,
  ValidationIssue
} from '../types';
import { getBindingDefinition } from './bindings';
import { extractGeneratedApiCalls, isAllowedGeneratedApiCall } from './jcmSpec';

export function validateProject(project: PidsProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const groupIds = new Set(project.groups.map((group) => group.id));
  const templateGroupId = 'rowTemplate';

  try {
    assertValidResourceNamespace(project.resourceNamespace);
  } catch (error) {
    issues.push(projectIssue('error', 'INVALID_RESOURCE_NAMESPACE', error instanceof Error ? error.message : 'Invalid resourceNamespace.'));
  }

  try {
    assertValidScriptPath(project.scriptPath);
  } catch (error) {
    issues.push(projectIssue('error', 'INVALID_SCRIPT_PATH', error instanceof Error ? error.message : 'Invalid scriptPath.'));
  }

  if (project.canvas.width <= 0 || project.canvas.height <= 0) {
    issues.push(projectIssue('error', 'INVALID_CANVAS', 'Canvas width and height must be greater than zero.'));
  }

  project.elements.forEach((element) => {
    if (ids.has(element.id)) {
      issues.push(elementIssue('error', 'DUPLICATE_ELEMENT_ID', element.id, `Duplicate element id: ${element.id}`));
    }
    ids.add(element.id);

    if (!groupIds.has(element.parentId ?? 'root')) {
      issues.push(elementIssue('error', 'MISSING_PARENT_GROUP', element.id, `${element.name} references a missing parent group.`));
    }

    const isTemplate = element.parentId === templateGroupId;
    const minY = isTemplate ? -element.h : 0;
    const maxY = isTemplate ? element.h : project.canvas.height;
    if (element.x < 0 || element.y < minY || element.x + element.w > project.canvas.width || element.y + element.h > maxY) {
      issues.push(elementIssue('warning', 'ELEMENT_OUT_OF_BOUNDS', element.id, `${element.name} is partially outside its canvas or row-template bounds.`));
    }

    if (element.w <= 0 || element.h <= 0) {
      issues.push(elementIssue('error', 'ELEMENT_INVALID_SIZE', element.id, `${element.name} has zero or negative size.`));
    }

    validateElementBinding(project, element, issues);

    if (element.kind === 'text') {
      if (!isColor(element.color)) {
        issues.push(elementIssue('error', 'INVALID_TEXT_COLOR', element.id, `${element.name} has an invalid text color.`));
      }
      if (element.overflow === 'marquee' && (element.marqueeDuration ?? 100) <= 0) {
        issues.push(elementIssue('error', 'INVALID_MARQUEE_DURATION', element.id, `${element.name} has an invalid marquee duration.`));
      }
    }

    if (element.kind === 'rect') {
      if (!isColor(element.fill)) {
        issues.push(elementIssue('error', 'INVALID_RECT_FILL', element.id, `${element.name} has an invalid fill color.`));
      }
    }

    if (element.kind === 'texture') {
      if (!element.textureId) {
        issues.push(elementIssue('error', 'TEXTURE_ID_MISSING', element.id, `${element.name} is missing a texture id.`));
      }
      if (element.tint && !isColor(element.tint)) {
        issues.push(elementIssue('error', 'INVALID_TEXTURE_TINT', element.id, `${element.name} has an invalid tint color.`));
      }
    }

    if (element.kind === 'circle') {
      if (!isColor(element.fill)) {
        issues.push(elementIssue('error', 'INVALID_CIRCLE_FILL', element.id, `${element.name} has an invalid route chip fill color.`));
      }
      if (!element.textureId) {
        issues.push(elementIssue('warning', 'CIRCLE_USING_PLACEHOLDER_TEXTURE', element.id, `${element.name} has no route chip texture; circle.png will be used.`));
      }
    }

    if (element.kind === 'line') {
      if (!isColor(element.stroke)) {
        issues.push(elementIssue('error', 'INVALID_LINE_STROKE', element.id, `${element.name} has an invalid line stroke color.`));
      }
      if (!isOrthogonalLine(element)) {
        issues.push(elementIssue('warning', 'LINE_ROTATION_UNVERIFIED', element.id, `${element.name} is not horizontal or vertical. v0.1 export only guarantees orthogonal lines.`));
      }
    }
  });

  return issues;
}

export function checkJcmCompatibility(project: PidsProject, generatedJs: string, manifest: ResourcePackManifest): JcmCompatibilityIssue[] {
  const issues: JcmCompatibilityIssue[] = [];

  const apiCalls = extractGeneratedApiCalls(generatedJs);
  apiCalls.forEach((call) => {
    if (!isAllowedGeneratedApiCall(call)) {
      issues.push(projectIssue('error', 'JCM_API_NOT_ALLOWED', `Generated JS uses unsupported ${call.object} method .${call.method}().`));
    }
  });

  const expectedResourceId = buildScriptResourceId(project.resourceNamespace, project.scriptPath);
  const expectedZipPath = buildScriptZipPath(project.resourceNamespace, project.scriptPath);

  if (manifest.scriptResourceId !== expectedResourceId || manifest.scriptZipPath !== expectedZipPath) {
    issues.push(projectIssue('error', 'RESOURCE_SCRIPT_PATH_MISMATCH', 'Generated resource manifest does not match the configured script path.'));
  }

  if (!manifest.files.includes('js-pids-editor.project.json')) {
    issues.push(projectIssue('error', 'PROJECT_METADATA_MISSING', 'Resource pack manifest is missing js-pids-editor.project.json.'));
  }

  if (generatedJs.includes(`safeCall(arrival`) === false && project.elements.some((element) => usesArrivalBinding(element))) {
    issues.push(projectIssue('error', 'ARRIVAL_BINDING_WITHOUT_NULL_GUARD', 'Generated row code may access arrival fields without using guarded helpers.'));
  }

  project.elements.forEach((element) => {
    if (element.kind === 'line' && !isOrthogonalLine(element)) {
      issues.push(elementIssue('warning', 'LINE_ROTATION_UNVERIFIED', element.id, `${element.name} uses a non-orthogonal line that is not guaranteed in JCM.`));
    }
    if (!isExportableElement(element)) {
      issues.push(elementIssue('error', 'NON_EXPORTABLE_ELEMENT', element.id, `${element.name} cannot be exported with the current JCM fallback rules.`));
    }
  });

  if (project.elements.some((element) => element.kind === 'text' && element.overflow === 'marquee')) {
    issues.push(projectIssue('warning', 'MARQUEE_RUNTIME_TIMING_UNVERIFIED', 'Marquee timing depends on JCM runtime behavior and should be smoke-tested.'));
  }

  return issues;
}

export function issueSummary(issues: Array<ValidationIssue | JcmCompatibilityIssue>) {
  return {
    errors: issues.filter((item) => item.severity === 'error').length,
    warnings: issues.filter((item) => item.severity === 'warning').length,
    info: issues.filter((item) => item.severity === 'info').length
  };
}

function validateElementBinding(project: PidsProject, element: PidsElement, issues: ValidationIssue[]) {
  const binding = element.kind === 'text' ? element.binding : element.kind === 'circle' ? element.binding : null;
  if (!binding) return;

  const definition = getBindingDefinition(binding);
  const inRepeatRows = element.parentId === 'rowTemplate';
  if (definition.requiresArrival && !inRepeatRows && typeof ('rowIndex' in element ? element.rowIndex : undefined) !== 'number') {
    issues.push(elementIssue('warning', 'ARRIVAL_BINDING_OUTSIDE_REPEAT_ROWS', element.id, `${element.name} uses an arrival binding outside Repeat Rows without a fixed row index.`));
  }
  if (definition.requiresPlatformVisible && element.condition !== 'platformVisible') {
    issues.push(elementIssue('warning', 'PLATFORM_BINDING_CONDITION_MISMATCH', element.id, `${element.name} uses a platform binding but is not guarded by platformVisible condition.`));
  }
}

function usesArrivalBinding(element: PidsElement) {
  const binding = element.kind === 'text' ? element.binding : element.kind === 'circle' ? element.binding : null;
  if (!binding) return false;
  return getBindingDefinition(binding).requiresArrival;
}

function isExportableElement(element: PidsElement) {
  if (element.kind === 'text' || element.kind === 'rect' || element.kind === 'texture' || element.kind === 'circle') return true;
  if (element.kind === 'line') return isOrthogonalLine(element);
  return false;
}

function isOrthogonalLine(element: Extract<PidsElement, { kind: 'line' }>) {
  return element.w === 0 || element.h === 0;
}

function isColor(value: string | undefined) {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? '');
}

function projectIssue(
  severity: ValidationIssue['severity'],
  code: string,
  message: string
): ValidationIssue {
  return {
    id: `${severity}-project-${code}`,
    severity,
    code,
    message,
    source: inferSource(code),
    target: { type: 'project' }
  };
}

function elementIssue(
  severity: ValidationIssue['severity'],
  code: string,
  elementId: string,
  message: string
): ValidationIssue {
  return {
    id: `${severity}-${elementId}-${code}`,
    severity,
    code,
    message,
    source: inferSource(code),
    target: { type: 'element', elementId }
  };
}

function inferSource(code: string): ValidationIssue['source'] {
  if (code.startsWith('RESOURCE') || code.includes('SCRIPT') || code.includes('PROJECT_METADATA')) return 'resource-pack';
  if (code.includes('BINDING') || code.includes('PLATFORM')) return 'binding';
  if (code.includes('JCM_API') || code.includes('NON_EXPORTABLE') || code.includes('MARQUEE') || code.includes('LINE_ROTATION')) return 'codegen';
  return 'schema';
}

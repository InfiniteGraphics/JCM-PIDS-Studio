export type PidsPreset = 'rv_pids' | 'rv_pids_sil_1' | 'rv_pids_sil_2' | 'lcd_pids' | 'pids_projector' | 'pids_1a';

export type MockScenario =
  | 'normal'
  | 'longDestination'
  | 'customMessage'
  | 'hiddenRow'
  | 'hidePlatform'
  | 'emptyArrivals'
  | 'terminating';

export type BindingKey =
  | 'static'
  | 'stationName'
  | 'clock'
  | 'pids.type'
  | 'pids.width'
  | 'pids.height'
  | 'pids.rows'
  | 'pids.getCustomMessage(i)'
  | 'pids.isRowHidden(i)'
  | 'pids.isPlatformNumberHidden()'
  | 'rowIndex'
  | 'rowNumber'
  | 'arrival.destination()'
  | 'arrival.routeName()'
  | 'arrival.routeNumber()'
  | 'arrival.routeColor()'
  | 'arrival.platformName()'
  | 'arrival.arrivalTime()'
  | 'arrival.departureTime()'
  | 'arrival.deviation()'
  | 'arrival.realtime()'
  | 'arrival.terminating()'
  | 'arrival.carCount()'
  | 'computed.etaText'
  | 'computed.routeDisplay'
  | 'computed.realtimeBadge';

export type TextOverflowMode = 'none' | 'stretchXY' | 'scaleXY' | 'wrapText' | 'marquee';
export type ElementCondition = 'always' | 'arrival' | 'customMessage' | 'platformVisible';
export type ImportSourceType = 'project-json' | 'embedded-js-metadata' | 'resource-shell';

export interface BaseElement {
  id: string;
  name: string;
  visible: boolean;
  locked?: boolean;
  parentId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  condition?: ElementCondition;
}

export interface TextElement extends BaseElement {
  kind: 'text';
  text: string;
  binding: BindingKey;
  rowIndex?: number;
  color: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  italic?: boolean;
  shadow?: boolean;
  font?: string;
  align: 'left' | 'center' | 'right';
  overflow: TextOverflowMode;
  marqueeDuration?: number;
  fallback: string;
}

export interface RectElement extends BaseElement {
  kind: 'rect';
  fill: string;
  stroke?: string;
  radius?: number;
  opacity?: number;
  textureId?: string;
  uv?: [number, number, number, number];
}

export interface LineElement extends BaseElement {
  kind: 'line';
  stroke: string;
  strokeWidth: number;
}

export interface CircleElement extends BaseElement {
  kind: 'circle';
  fill: string;
  stroke?: string;
  text?: string;
  textColor?: string;
  rowIndex?: number;
  binding?: BindingKey;
  textureId?: string;
}

export type PidsElement = TextElement | RectElement | LineElement | CircleElement;

export interface LayerGroup {
  id: string;
  name: string;
  visible: boolean;
  locked?: boolean;
  expanded?: boolean;
  children: string[];
}

export interface RepeatRowsConfig {
  enabled: boolean;
  groupId: string;
  name: string;
  startY: number;
  rowHeight: number;
  maxRows: number;
  countSource: 'pids.rows' | 'fixed';
  skipHiddenRows: boolean;
  collapseEmptyRows: boolean;
  customMessageMode: 'replace-row' | 'overlay' | 'ignore';
  showFallbackWhenEmpty: boolean;
}

export interface PidsBehavior {
  respectCustomMessage: boolean;
  respectHidePlatformNumber: boolean;
  respectHideArrival: boolean;
  usePidsDimensions: boolean;
  autoZOrdering: boolean;
  zOrderStep: number;
}

export interface PidsProject {
  schemaVersion: 2;
  name: string;
  preset: PidsPreset;
  resourceNamespace: string;
  scriptPath: string;
  canvas: {
    width: number;
    height: number;
  };
  groups: LayerGroup[];
  elements: PidsElement[];
  repeatRows: RepeatRowsConfig;
  behavior: PidsBehavior;
}

export interface ArrivalMock {
  routeName: string;
  routeNumber: string;
  routeColor: string;
  destination: string;
  arrivalTime: string;
  departureTime: string;
  deviation: number;
  realtime: boolean;
  terminating: boolean;
  platformName: string;
  carCount: number;
}

export interface MockRuntime {
  type: PidsPreset;
  width: number;
  height: number;
  rows: number;
  stationName: string;
  clock: string;
  customMessages: string[];
  hiddenRows: number[];
  hidePlatformNumber: boolean;
  arrivals: Array<ArrivalMock | null>;
}

export interface BindingPreviewContext {
  runtime: MockRuntime;
  rowIndex?: number;
}

export interface BindingCodegenContext {
  rowVar: string;
  arrivalVar: string;
  customMessageVar: string;
  platformHiddenVar: string;
  fallbackExpression: string;
  colorFallback?: string;
}

export interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  source: 'schema' | 'binding' | 'codegen' | 'resource-pack';
  target?:
    | { type: 'project' }
    | { type: 'element'; elementId: string }
    | { type: 'resource'; path: string }
    | { type: 'generated-js'; excerpt?: string };
}

export interface JcmCompatibilityIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  source: 'schema' | 'binding' | 'codegen' | 'resource-pack';
  target?:
    | { type: 'project' }
    | { type: 'element'; elementId: string }
    | { type: 'resource'; path: string }
    | { type: 'generated-js'; excerpt?: string };
}

export interface GeneratedArtifacts {
  script: string;
  scriptFilename: string;
  resourceJson: string;
  metadataFilename: string;
}

export interface ResourcePackManifest {
  scriptResourceId: string;
  scriptZipPath: string;
  projectMetadataPath: string;
  files: string[];
}

export interface ResourcePackBuildResult {
  blob: Blob;
  manifest: ResourcePackManifest;
}

export interface ProjectImportResult {
  source: ImportSourceType;
  project: PidsProject;
}

export interface EditorHistoryState {
  past: PidsProject[];
  future: PidsProject[];
}

export interface EditorCommand {
  type:
    | 'set-project'
    | 'update-project'
    | 'update-element'
    | 'delete-element'
    | 'duplicate-element'
    | 'add-element'
    | 'move-layer'
    | 'update-repeat-rows'
    | 'update-group';
}

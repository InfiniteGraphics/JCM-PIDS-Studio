import type {
  ArrivalMock,
  BindingCodegenContext,
  BindingKey,
  BindingPreviewContext,
  CircleElement,
  PidsElement,
  TextElement
} from '../types';

export interface BindingDefinition {
  key: BindingKey;
  label: string;
  group: string;
  requiresArrival: boolean;
  requiresPlatformVisible?: boolean;
  preview: (context: BindingPreviewContext, fallback: string, staticText?: string) => string;
  codegen: (context: BindingCodegenContext) => string;
}

const STATIC_CODE = ({ fallbackExpression }: BindingCodegenContext) => fallbackExpression;

export const BINDING_REGISTRY: Record<BindingKey, BindingDefinition> = {
  static: {
    key: 'static',
    label: 'Static text',
    group: 'Static',
    requiresArrival: false,
    preview: (_context, _fallback, staticText = '') => staticText,
    codegen: STATIC_CODE
  },
  stationName: {
    key: 'stationName',
    label: 'stationName',
    group: 'PIDS',
    requiresArrival: false,
    preview: ({ runtime }, fallback) => runtime.stationName || fallback,
    codegen: ({ fallbackExpression }) => `state.stationName || ${fallbackExpression}`
  },
  clock: {
    key: 'clock',
    label: 'current clock',
    group: 'PIDS',
    requiresArrival: false,
    preview: ({ runtime }, fallback) => runtime.clock || fallback,
    codegen: ({ fallbackExpression }) => `formatClock() || ${fallbackExpression}`
  },
  'pids.type': {
    key: 'pids.type',
    label: 'pids.type',
    group: 'PIDS',
    requiresArrival: false,
    preview: ({ runtime }) => runtime.type,
    codegen: () => `String(pids.type ?? '')`
  },
  'pids.width': {
    key: 'pids.width',
    label: 'pids.width',
    group: 'PIDS',
    requiresArrival: false,
    preview: ({ runtime }) => String(runtime.width),
    codegen: () => `String(pids.width ?? '')`
  },
  'pids.height': {
    key: 'pids.height',
    label: 'pids.height',
    group: 'PIDS',
    requiresArrival: false,
    preview: ({ runtime }) => String(runtime.height),
    codegen: () => `String(pids.height ?? '')`
  },
  'pids.rows': {
    key: 'pids.rows',
    label: 'pids.rows',
    group: 'PIDS',
    requiresArrival: false,
    preview: ({ runtime }) => String(runtime.rows),
    codegen: () => `String(pids.rows ?? '')`
  },
  'pids.getCustomMessage(i)': {
    key: 'pids.getCustomMessage(i)',
    label: 'pids.getCustomMessage(i)',
    group: 'PIDS',
    requiresArrival: false,
    preview: ({ runtime, rowIndex = 0 }, fallback) => runtime.customMessages[rowIndex] || fallback,
    codegen: ({ customMessageVar, fallbackExpression }) => `${customMessageVar} || ${fallbackExpression}`
  },
  'pids.isRowHidden(i)': {
    key: 'pids.isRowHidden(i)',
    label: 'pids.isRowHidden(i)',
    group: 'PIDS',
    requiresArrival: false,
    preview: ({ runtime, rowIndex = 0 }) => String(runtime.hiddenRows.includes(rowIndex)),
    codegen: ({ rowVar }) => `String(isRowHidden(${rowVar}))`
  },
  'pids.isPlatformNumberHidden()': {
    key: 'pids.isPlatformNumberHidden()',
    label: 'pids.isPlatformNumberHidden()',
    group: 'PIDS',
    requiresArrival: false,
    preview: ({ runtime }) => String(runtime.hidePlatformNumber),
    codegen: ({ platformHiddenVar }) => `String(${platformHiddenVar}())`
  },
  rowIndex: {
    key: 'rowIndex',
    label: 'row index',
    group: 'Row',
    requiresArrival: false,
    preview: ({ rowIndex = 0 }) => String(rowIndex),
    codegen: ({ rowVar }) => `String(${rowVar})`
  },
  rowNumber: {
    key: 'rowNumber',
    label: 'row number',
    group: 'Row',
    requiresArrival: false,
    preview: ({ rowIndex = 0 }) => String(rowIndex + 1),
    codegen: ({ rowVar }) => `String(${rowVar} + 1)`
  },
  'arrival.destination()': createArrivalBinding('arrival.destination()', 'destination', 'Arrival', (arrival, fallback) => arrival?.destination ?? fallback),
  'arrival.routeName()': createArrivalBinding('arrival.routeName()', 'routeName', 'Arrival', (arrival, fallback) => arrival?.routeName ?? fallback),
  'arrival.routeNumber()': createArrivalBinding('arrival.routeNumber()', 'routeNumber', 'Arrival', (arrival, fallback) => arrival?.routeNumber ?? fallback),
  'arrival.routeColor()': {
    key: 'arrival.routeColor()',
    label: 'arrival.routeColor()',
    group: 'Arrival',
    requiresArrival: true,
    preview: ({ runtime, rowIndex = 0 }, fallback) => runtime.arrivals[rowIndex]?.routeColor ?? fallback,
    codegen: ({ arrivalVar, fallbackExpression }) => `String(getRouteColor(${arrivalVar}, ${fallbackExpression}))`
  },
  'arrival.platformName()': {
    key: 'arrival.platformName()',
    label: 'arrival.platformName()',
    group: 'Arrival',
    requiresArrival: true,
    requiresPlatformVisible: true,
    preview: ({ runtime, rowIndex = 0 }, fallback) => runtime.arrivals[rowIndex]?.platformName ?? fallback,
    codegen: ({ arrivalVar, fallbackExpression }) => `safeCall(${arrivalVar}, 'platformName', ${fallbackExpression})`
  },
  'arrival.arrivalTime()': createArrivalBinding('arrival.arrivalTime()', 'arrivalTime', 'Arrival', (arrival, fallback) => arrival?.arrivalTime ?? fallback),
  'arrival.departureTime()': createArrivalBinding('arrival.departureTime()', 'departureTime', 'Arrival', (arrival, fallback) => arrival?.departureTime ?? fallback),
  'arrival.deviation()': {
    key: 'arrival.deviation()',
    label: 'arrival.deviation()',
    group: 'Arrival',
    requiresArrival: true,
    preview: ({ runtime, rowIndex = 0 }, fallback) => {
      const arrival = runtime.arrivals[rowIndex];
      return arrival ? String(arrival.deviation) : fallback;
    },
    codegen: ({ arrivalVar, fallbackExpression }) => `String(safeCall(${arrivalVar}, 'deviation', ${fallbackExpression}))`
  },
  'arrival.realtime()': {
    key: 'arrival.realtime()',
    label: 'arrival.realtime()',
    group: 'Arrival',
    requiresArrival: true,
    preview: ({ runtime, rowIndex = 0 }, fallback) => {
      const arrival = runtime.arrivals[rowIndex];
      return arrival ? String(arrival.realtime) : fallback;
    },
    codegen: ({ arrivalVar, fallbackExpression }) => `String(safeCall(${arrivalVar}, 'realtime', ${fallbackExpression}))`
  },
  'arrival.terminating()': {
    key: 'arrival.terminating()',
    label: 'arrival.terminating()',
    group: 'Arrival',
    requiresArrival: true,
    preview: ({ runtime, rowIndex = 0 }, fallback) => {
      const arrival = runtime.arrivals[rowIndex];
      return arrival ? String(arrival.terminating) : fallback;
    },
    codegen: ({ arrivalVar, fallbackExpression }) => `String(safeCall(${arrivalVar}, 'terminating', ${fallbackExpression}))`
  },
  'arrival.carCount()': {
    key: 'arrival.carCount()',
    label: 'arrival.carCount()',
    group: 'Arrival',
    requiresArrival: true,
    preview: ({ runtime, rowIndex = 0 }, fallback) => {
      const arrival = runtime.arrivals[rowIndex];
      return arrival ? String(arrival.carCount) : fallback;
    },
    codegen: ({ arrivalVar, fallbackExpression }) => `String(safeCall(${arrivalVar}, 'carCount', ${fallbackExpression}))`
  },
  'computed.etaText': {
    key: 'computed.etaText',
    label: 'ETA text',
    group: 'Computed',
    requiresArrival: true,
    preview: ({ runtime, rowIndex = 0 }, fallback) => {
      const arrival = runtime.arrivals[rowIndex];
      return arrival ? etaText(arrival) : fallback;
    },
    codegen: ({ arrivalVar, fallbackExpression }) => `formatEta(${arrivalVar}, ${fallbackExpression})`
  },
  'computed.routeDisplay': {
    key: 'computed.routeDisplay',
    label: 'Route display',
    group: 'Computed',
    requiresArrival: true,
    preview: ({ runtime, rowIndex = 0 }, fallback) => {
      const arrival = runtime.arrivals[rowIndex];
      return arrival ? `${arrival.routeNumber} ${arrival.routeName}`.trim() || fallback : fallback;
    },
    codegen: ({ arrivalVar, fallbackExpression }) => `formatRouteDisplay(${arrivalVar}, ${fallbackExpression})`
  },
  'computed.realtimeBadge': {
    key: 'computed.realtimeBadge',
    label: 'Realtime badge',
    group: 'Computed',
    requiresArrival: true,
    preview: ({ runtime, rowIndex = 0 }) => (runtime.arrivals[rowIndex]?.realtime ? 'RT' : ''),
    codegen: ({ arrivalVar }) => `safeCall(${arrivalVar}, 'realtime', false) ? 'RT' : ''`
  }
};

export const BINDING_OPTIONS = Object.values(BINDING_REGISTRY).map((item) => ({
  group: item.group,
  label: item.label,
  value: item.key
}));

export function getBindingDefinition(key: BindingKey) {
  return BINDING_REGISTRY[key];
}

export function resolveBinding(binding: BindingKey, context: BindingPreviewContext, fallback = '--', staticText = ''): string {
  return getBindingDefinition(binding).preview(context, fallback, staticText);
}

export function resolveBindingCode(binding: BindingKey, context: BindingCodegenContext) {
  return getBindingDefinition(binding).codegen(context);
}

export function resolveElementText(element: PidsElement, context: BindingPreviewContext): string {
  if (element.kind === 'text') {
    return resolveBinding(element.binding, context, element.fallback || element.text || '--', element.text);
  }
  if (element.kind === 'circle') {
    return resolveCircleBinding(element, context);
  }
  return '';
}

export function getRouteFill(element: PidsElement, context: BindingPreviewContext): string {
  const fallback = element.kind === 'circle' ? element.fill : '#1769d7';
  const rowIndex = context.rowIndex ?? 0;
  const arrival = context.runtime.arrivals[rowIndex];
  if (element.kind === 'circle' && element.binding === 'arrival.routeNumber()') {
    return arrival?.routeColor ?? fallback;
  }
  return fallback;
}

export function etaText(arrival: ArrivalMock) {
  if (arrival.terminating) return 'Terminating';
  const minutes = estimateMinutes(arrival.arrivalTime);
  if (minutes <= 0) return 'Arr';
  const suffix = arrival.deviation > 0 ? ` +${arrival.deviation}` : arrival.deviation < 0 ? ` ${arrival.deviation}` : '';
  return `${minutes} min${suffix}`;
}

function resolveCircleBinding(element: CircleElement, context: BindingPreviewContext): string {
  const fallback = element.text || '';
  if (!element.binding) return fallback;
  if (element.binding === 'computed.routeDisplay') {
    return resolveBinding('arrival.routeNumber()', context, fallback, fallback);
  }
  return resolveBinding(element.binding, context, fallback, fallback);
}

function estimateMinutes(time: string) {
  const [, minuteText] = time.split(':');
  const minute = Number(minuteText);
  if (!Number.isFinite(minute)) return 0;
  const baseMinute = 24;
  const diff = minute - baseMinute;
  return diff < 0 ? diff + 60 : diff;
}

function createArrivalBinding(
  key: BindingKey,
  label: string,
  group: string,
  previewResolver: (arrival: ArrivalMock | null, fallback: string) => string
): BindingDefinition {
  return {
    key,
    label,
    group,
    requiresArrival: true,
    preview: ({ runtime, rowIndex = 0 }, fallback) => previewResolver(runtime.arrivals[rowIndex] ?? null, fallback),
    codegen: ({ arrivalVar, fallbackExpression }) => `safeCall(${arrivalVar}, '${label}', ${fallbackExpression})`
  };
}

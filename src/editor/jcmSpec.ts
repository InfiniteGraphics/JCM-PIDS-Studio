export const JCM_TARGET = {
  version: '2.2',
  docs: [
    'https://jcm.joban.org/v2.2/dev/scripting/type/pids/',
    'https://jcm.joban.org/v2.2/dev/scripting/type/pids/tut/pids_tut/'
  ]
} as const;

export const ALLOWED_JCM_OBJECTS = ['Text', 'Texture', 'ctx', 'state', 'pids'] as const;

export const ALLOWED_TEXT_METHODS = [
  'create',
  'pos',
  'size',
  'text',
  'scale',
  'color',
  'leftAlign',
  'centerAlign',
  'rightAlign',
  'shadowed',
  'italic',
  'bold',
  'stretchXY',
  'scaleXY',
  'wrapText',
  'marquee',
  'font',
  'draw',
  'zOrder'
] as const;

export const ALLOWED_TEXTURE_METHODS = [
  'create',
  'pos',
  'size',
  'texture',
  'color',
  'uv',
  'draw',
  'zOrder'
] as const;

export const ALLOWED_PIDS_MEMBERS = [
  'type',
  'width',
  'height',
  'rows',
  'arrivals',
  'getCustomMessage',
  'isRowHidden',
  'isPlatformNumberHidden'
] as const;

export const ALLOWED_ARRIVAL_METHODS = [
  'destination',
  'routeName',
  'routeNumber',
  'routeColor',
  'platformName',
  'arrivalTime',
  'departureTime',
  'deviation',
  'realtime',
  'terminating',
  'carCount'
] as const;

export type AllowedTextMethod = (typeof ALLOWED_TEXT_METHODS)[number];
export type AllowedTextureMethod = (typeof ALLOWED_TEXTURE_METHODS)[number];

export function emitTextCall(method: AllowedTextMethod, args: string[]) {
  return `.${method}(${args.join(', ')})`;
}

export function emitTextureCall(method: AllowedTextureMethod, args: string[]) {
  return `.${method}(${args.join(', ')})`;
}

export function extractMethodCalls(script: string) {
  const pattern = /\.(\w+)\(/g;
  const calls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(script))) {
    calls.push(match[1]);
  }
  return calls;
}

export function isAllowedGeneratedMethod(name: string) {
  return (
    (ALLOWED_TEXT_METHODS as readonly string[]).includes(name) ||
    (ALLOWED_TEXTURE_METHODS as readonly string[]).includes(name)
  );
}

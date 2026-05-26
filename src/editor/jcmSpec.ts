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

export const ALLOWED_CTX_METHODS = [
  'setAutoZOrdering',
  'setZOrderStep'
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
export type AllowedCtxMethod = (typeof ALLOWED_CTX_METHODS)[number];

export interface GeneratedApiCall {
  object: 'Text' | 'Texture' | 'ctx' | 'pids';
  method: string;
}

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

export function extractGeneratedApiCalls(script: string): GeneratedApiCall[] {
  return [
    ...extractChainedCalls(script, 'Text'),
    ...extractChainedCalls(script, 'Texture'),
    ...extractDirectCalls(script, 'ctx'),
    ...extractDirectCalls(script, 'pids')
  ];
}

export function isAllowedGeneratedMethod(name: string) {
  return (
    (ALLOWED_TEXT_METHODS as readonly string[]).includes(name) ||
    (ALLOWED_TEXTURE_METHODS as readonly string[]).includes(name)
  );
}

export function isAllowedGeneratedApiCall(call: GeneratedApiCall) {
  if (call.object === 'Text' || call.object === 'Texture') {
    return isAllowedGeneratedMethod(call.method);
  }
  if (call.object === 'ctx') {
    return (ALLOWED_CTX_METHODS as readonly string[]).includes(call.method);
  }
  if (call.object === 'pids') {
    return (ALLOWED_PIDS_MEMBERS as readonly string[]).includes(call.method);
  }
  return false;
}

function extractChainedCalls(script: string, root: 'Text' | 'Texture'): GeneratedApiCall[] {
  const calls: GeneratedApiCall[] = [];
  const rootPattern = new RegExp(`\\b${root}\\.create\\(`, 'g');
  let match: RegExpExecArray | null;

  while ((match = rootPattern.exec(script))) {
    calls.push({ object: root, method: 'create' });
    let index = match.index + `${root}.create(`.length;
    index = skipCallArguments(script, index);

    while (script[index] === '.') {
      index += 1;
      const nameMatch = /^[A-Za-z_]\w*/.exec(script.slice(index));
      if (!nameMatch) break;
      const method = nameMatch[0];
      index += method.length;
      if (script[index] !== '(') break;
      calls.push({ object: root, method });
      index += 1;
      index = skipCallArguments(script, index);
    }
  }

  return calls;
}

function extractDirectCalls(script: string, root: 'ctx' | 'pids'): GeneratedApiCall[] {
  const calls: GeneratedApiCall[] = [];
  const pattern = new RegExp(`\\b${root}\\.(\\w+)(\\?\\.)?\\(`, 'g');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(script))) {
    calls.push({ object: root, method: match[1] });
  }

  return calls;
}

function skipCallArguments(script: string, start: number) {
  let depth = 1;
  let index = start;

  while (index < script.length && depth > 0) {
    const char = script[index];

    if (char === '"' || char === "'" || char === '`') {
      index = skipQuoted(script, index);
      continue;
    }

    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    index += 1;
  }

  return index;
}

function skipQuoted(script: string, start: number) {
  const quote = script[start];
  let index = start + 1;

  while (index < script.length) {
    if (script[index] === '\\') {
      index += 2;
      continue;
    }
    if (script[index] === quote) {
      return index + 1;
    }
    index += 1;
  }

  return index;
}

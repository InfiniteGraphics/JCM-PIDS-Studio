import type { PidsElement } from '../types';
import { round } from './rendering';

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export function resizeFromHandle(
  start: PidsElement,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  gridSize: number,
  shouldSnap: boolean
): Partial<PidsElement> {
  const snapValue = (value: number) => (shouldSnap ? Math.round(value / gridSize) * gridSize : round(value));

  if (start.kind === 'texture' && start.preserveAspectRatio !== false) {
    return resizeTextureWithAspectRatio(start, handle, dx, dy, snapValue);
  }

  const patch: Partial<PidsElement> = {};

  if (handle.includes('e')) patch.w = Math.max(0.5, snapValue(start.w + dx));
  if (handle.includes('s')) patch.h = Math.max(0.5, snapValue(start.h + dy));

  if (handle.includes('w')) {
    const nextX = snapValue(start.x + dx);
    patch.x = nextX;
    patch.w = Math.max(0.5, snapValue(start.w + (start.x - nextX)));
  }

  if (handle.includes('n')) {
    const nextY = snapValue(start.y + dy);
    patch.y = nextY;
    patch.h = Math.max(0.5, snapValue(start.h + (start.y - nextY)));
  }

  return patch;
}

function resizeTextureWithAspectRatio(
  start: Extract<PidsElement, { kind: 'texture' }>,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  snapValue: (value: number) => number
): Partial<PidsElement> {
  const startWidth = Math.max(0.5, start.w);
  const startHeight = Math.max(0.5, start.h);
  const startLength = Math.hypot(startWidth, startHeight);
  const directionX = handle.includes('w') ? -1 : 1;
  const directionY = handle.includes('n') ? -1 : 1;
  const startVectorX = directionX * startWidth;
  const startVectorY = directionY * startHeight;
  const unitX = startVectorX / startLength;
  const unitY = startVectorY / startLength;
  const proposedVectorX = startVectorX + dx;
  const proposedVectorY = startVectorY + dy;
  const projectedLength = proposedVectorX * unitX + proposedVectorY * unitY;
  const minScale = Math.max(0.5 / startWidth, 0.5 / startHeight);
  const nextScale = Math.max(minScale, projectedLength / startLength);
  const nextW = Math.max(0.5, snapValue(startWidth * nextScale));
  const nextH = Math.max(0.5, snapValue(startHeight * nextScale));

  return {
    x: handle.includes('w') ? snapValue(start.x + (startWidth - nextW)) : start.x,
    y: handle.includes('n') ? snapValue(start.y + (startHeight - nextH)) : start.y,
    w: nextW,
    h: nextH
  };
}

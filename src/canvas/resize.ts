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

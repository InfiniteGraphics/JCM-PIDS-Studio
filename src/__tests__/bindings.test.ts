import { describe, expect, it } from 'vitest';
import { getMockRuntime } from '../data/mockPids';
import { BINDING_REGISTRY, resolveBinding, resolveBindingCode } from '../editor/bindings';

describe('binding registry', () => {
  it('uses the same preview resolver for arrival bindings', () => {
    const runtime = getMockRuntime('normal');
    expect(resolveBinding('arrival.destination()', { runtime, rowIndex: 0 }, '--')).toBe('Airport');
    expect(resolveBinding('computed.realtimeBadge', { runtime, rowIndex: 0 }, '--')).toBe('RT');
    expect(resolveBinding('pids.station()', { runtime }, '--')).toBe('Central Station');
    expect(resolveBinding('arrivals.platforms()', { runtime }, '--')).toBe('1, 2, 3, 4');
  });

  it('marks arrival bindings correctly', () => {
    expect(BINDING_REGISTRY['arrival.destination()'].requiresArrival).toBe(true);
    expect(BINDING_REGISTRY.static.requiresArrival).toBe(false);
    expect(BINDING_REGISTRY['arrival.platformName()'].requiresPlatformVisible).toBe(true);
  });

  it('produces codegen expressions from the same registry', () => {
    const output = resolveBindingCode('arrival.destination()', {
      rowVar: 'i',
      arrivalVar: 'arrival',
      customMessageVar: 'customMessage',
      platformHiddenVar: 'isPlatformHidden',
      fallbackExpression: '"--"'
    });

    expect(output).toContain("safeCall(arrival, 'destination'");
  });
});

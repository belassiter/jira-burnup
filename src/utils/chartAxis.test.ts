import { describe, expect, it } from 'vitest';
import { getRoundedYAxisMax, getYAxisTicks } from './chartAxis';

describe('chartAxis', () => {
    it('rounds up max to a standard nice value', () => {
        expect(getRoundedYAxisMax(182)).toBe(200);
        expect(getRoundedYAxisMax(200)).toBe(200);
    });

    it('uses standard nice increments and starts at zero', () => {
        expect(getYAxisTicks(182)).toEqual([0, 50, 100, 150, 200]);
        expect(getYAxisTicks(182)[0]).toBe(0);
    });

    it('handles empty/invalid data safely', () => {
        expect(getYAxisTicks(0)).toEqual([0, 1]);
        expect(getYAxisTicks(Number.NaN)).toEqual([0, 1]);
    });

    it('avoids awkward non-standard increments like 700', () => {
        // For larger values, nice ticks should be powers/2x/5x scaled values.
        // 4200 should resolve to a 1000-step scale, not 700.
        expect(getYAxisTicks(4200)).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
    });
});

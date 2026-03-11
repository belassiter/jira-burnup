import { describe, expect, it } from 'vitest';
import { getRoundedYAxisMax, getYAxisTicks } from './chartAxis';

describe('chartAxis', () => {
    it('rounds up max to next multiple of 50', () => {
        expect(getRoundedYAxisMax(182)).toBe(200);
        expect(getRoundedYAxisMax(200)).toBe(200);
    });

    it('returns fixed-step ticks at 50 increments', () => {
        expect(getYAxisTicks(182)).toEqual([0, 50, 100, 150, 200]);
    });

    it('handles empty/invalid data safely', () => {
        expect(getYAxisTicks(0)).toEqual([0, 50]);
        expect(getYAxisTicks(Number.NaN)).toEqual([0, 50]);
    });
});

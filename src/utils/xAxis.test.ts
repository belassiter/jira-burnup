import { addDays, differenceInCalendarDays, differenceInCalendarWeeks, format, getDay, parseISO } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { getXAxisTicks } from './xAxis';

function buildWeekdayDateStrings(start: string, end: string): string[] {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    const out: string[] = [];

    for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
        const day = getDay(d);
        if (day !== 0 && day !== 6) {
            out.push(format(d, 'yyyy-MM-dd'));
        }
    }

    return out;
}

describe('xAxis ticks', () => {
    it('shows every day for short date ranges', () => {
        const available = buildWeekdayDateStrings('2026-03-02', '2026-03-10');
        const ticks = getXAxisTicks(available, new Date('2026-03-02'), new Date('2026-03-10'));

        expect(ticks).toEqual(available);
    });

    it('shows start/end plus Monday-based week increments for long ranges', () => {
        const start = '2025-11-11';
        const end = '2026-04-17';
        const available = buildWeekdayDateStrings(start, end);
        const ticks = getXAxisTicks(available, parseISO(start), parseISO(end));

        expect(ticks[0]).toBe(start);
        expect(ticks[ticks.length - 1]).toBe(end);

        const interior = ticks.slice(1, -1);
        interior.forEach((dateStr) => {
            const d = parseISO(dateStr);
            expect(getDay(d)).toBe(1); // Monday
        });

        const totalWeeks = Math.max(1, differenceInCalendarWeeks(parseISO(end), parseISO(start), { weekStartsOn: 1 }));
        const stepWeeks = Math.max(1, Math.ceil(totalWeeks / 8));
        const stepDays = stepWeeks * 7;

        if (interior.length > 0) {
            const firstInteriorGap = differenceInCalendarDays(parseISO(interior[0]), parseISO(start));
            expect(firstInteriorGap).toBeGreaterThanOrEqual(stepDays - 1);

            const endGap = differenceInCalendarDays(parseISO(end), parseISO(interior[interior.length - 1]));
            expect(endGap).toBeGreaterThanOrEqual(Math.max(5, Math.round(stepDays * 0.6)));
        }
    });

    it('downsamples short-range daily ticks when weekday count is high', () => {
        // 13 weekdays from 2026-03-02 to 2026-03-18
        const start = '2026-03-02';
        const end = '2026-03-18';
        const available = buildWeekdayDateStrings(start, end);
        const ticks = getXAxisTicks(available, parseISO(start), parseISO(end));

        expect(available.length).toBe(13);
        expect(ticks[0]).toBe(start);
        expect(ticks[ticks.length - 1]).toBe(end);
        expect(ticks.length).toBeLessThan(available.length);
    });
});

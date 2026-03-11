import {
    addWeeks,
    differenceInCalendarDays,
    differenceInCalendarWeeks,
    format,
    isBefore,
    parseISO,
    startOfWeek,
} from 'date-fns';

const SHORT_RANGE_DAY_MODE_MAX_DAYS = 21;
const TARGET_WEEK_TICKS = 8;
const MAX_DAILY_TICKS = 9;

export function getXAxisTicks(
    availableDates: string[],
    selectedStartDate?: Date | null,
    selectedEndDate?: Date | null
): string[] {
    if (availableDates.length === 0) return [];

    const sortedDates = [...availableDates].sort();
    const firstAvailable = parseISO(sortedDates[0]);
    const lastAvailable = parseISO(sortedDates[sortedDates.length - 1]);

    const start = selectedStartDate ?? firstAvailable;
    const end = selectedEndDate ?? lastAvailable;

    const totalDays = differenceInCalendarDays(end, start) + 1;

    // Short range: show individual days (already weekday-quantized by data source)
    if (totalDays <= SHORT_RANGE_DAY_MODE_MAX_DAYS) {
        if (sortedDates.length <= MAX_DAILY_TICKS) {
            return sortedDates;
        }

        // Keep start/end, sample interior dates to avoid overlap in medium-short ranges
        const sampled = new Set<string>();
        sampled.add(sortedDates[0]);

        const step = Math.ceil((sortedDates.length - 1) / (MAX_DAILY_TICKS - 1));
        for (let i = step; i < sortedDates.length - 1; i += step) {
            sampled.add(sortedDates[i]);
        }

        sampled.add(sortedDates[sortedDates.length - 1]);
        return Array.from(sampled).sort();
    }

    // Long range: start + Monday ticks at fixed integer week increments + end
    const totalWeeks = Math.max(1, differenceInCalendarWeeks(end, start, { weekStartsOn: 1 }));
    const stepWeeks = Math.max(1, Math.ceil(totalWeeks / TARGET_WEEK_TICKS));

    const ticks = new Set<string>();
    ticks.add(format(start, 'yyyy-MM-dd'));

    // Make the first interior Monday roughly one full step from start,
    // so the start label does not overlap with the first weekly label.
    const targetFirstTick = addWeeks(start, stepWeeks);
    let mondayTick = startOfWeek(targetFirstTick, { weekStartsOn: 1 });
    if (isBefore(mondayTick, targetFirstTick)) {
        mondayTick = addWeeks(mondayTick, 1);
    }

    const mondayTicks: string[] = [];
    while (isBefore(mondayTick, end)) {
        mondayTicks.push(format(mondayTick, 'yyyy-MM-dd'));
        mondayTick = addWeeks(mondayTick, stepWeeks);
    }

    // If the last Monday tick is very close to the end date,
    // drop it to avoid label overlap with the mandatory end tick.
    if (mondayTicks.length > 0) {
        const lastMonday = parseISO(mondayTicks[mondayTicks.length - 1]);
        const daysBetweenLastMondayAndEnd = differenceInCalendarDays(end, lastMonday);
        const minimumEndSpacingDays = Math.max(5, Math.round(stepWeeks * 7 * 0.6));

        if (daysBetweenLastMondayAndEnd < minimumEndSpacingDays) {
            mondayTicks.pop();
        }
    }

    mondayTicks.forEach((tick) => ticks.add(tick));

    ticks.add(format(end, 'yyyy-MM-dd'));

    return Array.from(ticks).sort();
}

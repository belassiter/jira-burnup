export const Y_AXIS_TICK_STEP = 50;

export function getRoundedYAxisMax(maxValue: number, step = Y_AXIS_TICK_STEP): number {
    if (!Number.isFinite(maxValue) || maxValue <= 0) return step;
    return Math.ceil(maxValue / step) * step;
}

export function getYAxisTicks(maxValue: number, step = Y_AXIS_TICK_STEP): number[] {
    const roundedMax = getRoundedYAxisMax(maxValue, step);
    const ticks: number[] = [];

    for (let v = 0; v <= roundedMax; v += step) {
        ticks.push(v);
    }

    return ticks;
}

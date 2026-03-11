const TARGET_TICK_COUNT = 6;

function getNiceStep(maxValue: number, targetTickCount = TARGET_TICK_COUNT): number {
    if (!Number.isFinite(maxValue) || maxValue <= 0) return 1;

    const roughStep = maxValue / targetTickCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;

    if (normalized <= 1) return 1 * magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
}

export function getRoundedYAxisMax(maxValue: number, targetTickCount = TARGET_TICK_COUNT): number {
    const step = getNiceStep(maxValue, targetTickCount);
    if (!Number.isFinite(maxValue) || maxValue <= 0) return step;
    return Math.ceil(maxValue / step) * step;
}

export function getYAxisTicks(maxValue: number, targetTickCount = TARGET_TICK_COUNT): number[] {
    const step = getNiceStep(maxValue, targetTickCount);
    const roundedMax = getRoundedYAxisMax(maxValue, targetTickCount);
    const ticks: number[] = [];

    for (let v = 0; v <= roundedMax; v += step) {
        ticks.push(v);
    }

    // Guarantee first label is always 0.
    if (ticks[0] !== 0) {
        ticks.unshift(0);
    }

    return ticks;
}

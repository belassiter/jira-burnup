
import { StatusConfig, ForecastConfig } from '../types';

export interface ChartPoint {
    date: string;
    [key: string]: any; 
}

const calculateDoneCount = (point: ChartPoint, doneStatuses: string[]): number => {
    let count = 0;
    for (const status of doneStatuses) {
        const val = point[status];
        if (typeof val === 'number') {
            count += val;
        }
    }
    return count;
};

const calculateTotalScope = (point: ChartPoint, statusConfigs: StatusConfig[]): number => {
    let total = 0;
    const scopes: string[] = [];
    for (const config of statusConfigs) {
        // IMPORTANT: We include DISABLED statuses in the scope calculation.
        // Users often disable statuses like 'In Progress' or 'Todo' to declutter the chart view,
        // but they still represent work that needs to be done.
        // Excluding them would make remainingScope = 0 prematurely.
        
        const val = point[config.name];
        
        // If the value is missing from the point (because processDailySnapshots didn't include it?), we assume 0.
        // But processDailySnapshots usually includes all statuses found in issues.
        // If config.name is valid, point[config.name] should be there.
        
        if (typeof val === 'number') {
            total += val;
            if (val > 0) scopes.push(`${config.name}=${val}`);
        }
    }
    // console.log(`Forecasting: Total Scope at ${point.date}: ${total} (${scopes.join(', ')})`);
    return total;
};

export interface ForecastResult {
    forecastPoints: ChartPoint[];
    avgVelocity: number;
    daysToComplete: number;
    completionDate: string | null;
    simulationResults?: {
        slopes: number[];
        completionDates: string[]; // ISO Date strings
    };
}

export const generateForecast = (
    data: ChartPoint[], 
    forecastConfig: ForecastConfig,
    statusConfigs: StatusConfig[],
    endDate?: string
): ForecastResult | null => {
    if (!forecastConfig.enabled || data.length < 2) return null;

    const doneStatuses = statusConfigs
        .filter(s => s.category === 'done' && s.enabled)
        .map(s => s.name);

    if (doneStatuses.length === 0) {
        console.warn('Forecasting: No enabled "Done" statuses found. StatusConfigs:', statusConfigs);
        return null; // Return null effectively hides forecast
    }

    // Filter valid data points (exclude future placeholder points that have no data)
    // processDailySnapshots adds future dates for axis drawing but they lack status keys.
    // We check if at least one status key exists in the point.
    // Or simpler: filter out points where "Done" statuses (or any status) are undefined.
    
    // We can check if any known status key has a numeric value.
    const hasData = (point: ChartPoint) => {
        return statusConfigs.some(c => typeof point[c.name] === 'number');
    };

    const validData = data.filter(point => hasData(point));
    
    if (validData.length === 0) {
         console.warn('Forecasting: No valid data points found with metric values.');
         return null;
    }

    console.log(`Forecasting: Inputs - Data Points: ${validData.length} (original: ${data.length}), DoneStatuses: ${doneStatuses.join(', ')}`);
    console.log('Forecasting: Base Data (Last 5 points):', JSON.stringify(validData.slice(-5), null, 2));

    // We need at least 2 points to calculate a velocity
    if (validData.length < 2) {
        console.warn('Forecasting: Not enough data points (<2).');
        return null;
    }

    const isWeekend = (d: Date) => {
        // Use getUTCDay because our input dates are 'YYYY-MM-DD' strings 
        // which parse to UTC midnight. We want to check the day of that specific date,
        // independent of the user's local timezone.
        const day = d.getUTCDay();
        return day === 0 || day === 6;
    };
    
    // Debug: Check strict velocity calculation
    // "Datapoints to average" means use the last N intervals.
    // If N=3, we need the last 4 points to get 3 velocity values.
    const intervals = Math.max(1, Math.floor(forecastConfig.avgDatapoints));
    const numPoints = Math.min(intervals + 1, validData.length);
    const recentData = validData.slice(-numPoints); 

    const velocities: number[] = [];
    const workDayVelocities: number[] = [];

    for (let i = 1; i < recentData.length; i++) {
        const today = calculateDoneCount(recentData[i], doneStatuses);
        const yesterday = calculateDoneCount(recentData[i-1], doneStatuses);
        const vel = today - yesterday;
        velocities.push(vel); // Calendar velocity
        
        // Track velocities that likely happened on workdays?
        // Data points usually represent 'end of day'.
        // So the delta from Sun->Mon happened on Monday (Workday).
        // Delta from Fri->Sat happened on Saturday (Weekend).
        const dateObj = new Date(recentData[i].date);
        if (!isWeekend(dateObj)) {
            workDayVelocities.push(vel);
        }
        
        console.log(`Forecasting: Velocity[${recentData[i].date}]: ${vel}`);
    }
    
    // Use workDayVelocities for simulation if available, else fall back
    const simVelocities = workDayVelocities.length > 0 ? workDayVelocities : velocities;

    console.log('Forecasting: Calculated Velocities:', velocities);
    console.log('Forecasting: Work Day Velocities:', workDayVelocities);

    if (velocities.length === 0) return null;

    // Average Velocity (Calendar based for standard projection)
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    
    // Average Work Day Velocity
    const avgWorkDayVelocity = simVelocities.length > 0 
        ? simVelocities.reduce((a, b) => a + b, 0) / simVelocities.length 
        : avgVelocity * 1.4; // Fallback if no workday history found
        
    console.log('Forecasting: Average Velocity:', avgVelocity, 'WorkDay:', avgWorkDayVelocity);

    // Current State
    const lastPoint = validData[validData.length - 1];
    const lastDate = new Date(lastPoint.date); // Ensure date parsing works for 'YYYY-MM-DD'
    const lastDoneCount = calculateDoneCount(lastPoint, doneStatuses);
    
    // We calculate total scope based on ALL enabled statuses in the config, not just done.
    const totalScope = calculateTotalScope(lastPoint, statusConfigs); // Current total scope
    
    // Debug Scope
    const debugScope = statusConfigs
        .filter(s => s.enabled)
        .map(s => `${s.name}=${lastPoint[s.name] || 0}`)
        .join(', ');
    console.log(`Forecasting: Total Scope Breakdown: [${debugScope}] -> Total: ${totalScope}, Done: ${lastDoneCount}`);

    const remainingScope = totalScope - lastDoneCount;

    // Visualization: We want to connect the forecast line to the actuals.
    // So the first point of the forecast is the last point of the actual data.
    const forecastPoints: ChartPoint[] = [];

    // Extend forecasted completion to the left (backwards) to show the trend
    // based on the datapoints used for calculation.
    // We project backwards from the anchor point using the calculated velocity.
    // Logic: Iterate recentData backwards from (end-1) to 0.
    
    // Reverse iterate recentData (excluding the last point which is the anchor)
    // We calculate "how many workdays back" this point is.
    let workDaysBack = 0;
    // recentData is sorted by date ascending. 
    // We iterate from second-to-last item backwards.
    for (let i = recentData.length - 2; i >= 0; i--) {
        const pointDate = new Date(recentData[i].date);
        
        // Count workdays between this point and the next point (i+1)
        // Since recentData likely has consecutive days (daily snapshots),
        // we just check if the (i+1) date was a workday?
        // Actually, logic is: We subtract velocity for every workday we go back.
        // We need to know how many workdays between recentData[i] and lastDate.
        
        // The most robust way:
        const nextPointDate = new Date(recentData[i+1].date);
        const daysDiff = Math.round((nextPointDate.getTime() - pointDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let workDaysInInterval = 0;
        for (let d = 1; d <= daysDiff; d++) {
             const checkDate = new Date(pointDate);
             checkDate.setUTCDate(checkDate.getUTCDate() + d); 
             if (!isWeekend(checkDate)) {
                 workDaysInInterval++;
             }
        }
        
        workDaysBack += workDaysInInterval;
        
        const backProjectedValue = lastDoneCount - (workDaysBack * avgWorkDayVelocity);
        
        forecastPoints.push({
            date: recentData[i].date,
            Forecast: backProjectedValue,
            // Do not extend dotted lines (Confidence/TotalScope)
        });
    }
    
    // Sort forecastPoints because we pushed them in reverse order
    forecastPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Add anchor point (used for plotting, but also confidence base)
    const anchorPoint: ChartPoint = {
        date: lastPoint.date,
        Forecast: lastDoneCount,
    };
    // Initialize confidence boundaries at the actual known value (0 uncertainty at T=0)
    if (forecastConfig.showConfidence) {
        anchorPoint.ConfidenceHigh = lastDoneCount;
        anchorPoint.ConfidenceLow = lastDoneCount;
    }
    forecastPoints.push(anchorPoint);

    // Date utility to add days properly
    const addDays = (d: Date, n: number) => {
        const result = new Date(d);
        result.setUTCDate(result.getUTCDate() + n); 
        // Use UTC for consistent date strings
        return result.toISOString().split('T')[0];
    };

    if (remainingScope <= 0) {
        console.log('Forecasting: Scope completed. Remaining:', remainingScope);
        // Even if done, we want to project until the end of the view if requested.
        const horizon = endDate ? Math.floor((new Date(endDate).getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : 14;
        const validHorizon = Math.max(0, horizon);
        
        for (let i = 1; i <= validHorizon; i++) {
            const nextDate = addDays(lastDate, i);
            const point: ChartPoint = {
                date: nextDate,
                Forecast: lastDoneCount,
            };
            if (forecastConfig.showConfidence) {
                point.ConfidenceHigh = lastDoneCount;
                point.ConfidenceLow = lastDoneCount;
            }
            forecastPoints.push(point);
        }
        
        return {
            forecastPoints,
            avgVelocity,
            daysToComplete: 0,
            completionDate: lastPoint.date
        };
    }
    
    // Determine how many days to project
    // Default to strict 'daysToComplete' if no endDate provided, or MAX_DAYS
    const projectedCompletionDays = (avgVelocity > 0) ? Math.ceil(remainingScope / avgVelocity) : Infinity;

    let projectionDays = 0;
    if (endDate) {
        // Project strictly to the end date of the chart
        const endD = new Date(endDate);
        const diffTime = Math.abs(endD.getTime() - lastDate.getTime());
        projectionDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    } else {
         // Fallback to original behavior (project to completion)
         const MAX_DAYS = 365 * 2; 
         if (projectedCompletionDays === Infinity) {
             projectionDays = 14; 
         } else {
             projectionDays = Math.min(projectedCompletionDays, MAX_DAYS);
         }
    }
    
    if (avgVelocity <= 0) {
        console.log('Forecasting: Velocity <= 0. Projecting stalled horizion.');
         // Project a flat line for the duration
        for (let i = 1; i <= projectionDays; i++) {
            const nextDate = addDays(lastDate, i);
            const point: ChartPoint = {
                date: nextDate,
                Forecast: lastDoneCount,
            };
            if (forecastConfig.showConfidence) {
                point.ConfidenceHigh = lastDoneCount;
                point.ConfidenceLow = lastDoneCount;
            }
            forecastPoints.push(point);
        }

        return {
            forecastPoints,
            avgVelocity,
            daysToComplete: Infinity,
            completionDate: null
        };
    }

    // Generate Points for Average Line
    
    // Monte Carlo Simulation for Confidence Slope & Work Day Calculation
    
    // 1. Calculate how many "Work Days" are in the projection period.
    let workDaysInProjection = 0;
    for (let d = 1; d <= projectionDays; d++) {
          const dateToCheck = new Date(lastDate);
          dateToCheck.setUTCDate(dateToCheck.getUTCDate() + d);
          if (!isWeekend(dateToCheck)) workDaysInProjection++;
    }

    let finalLow = lastDoneCount;
    let finalHigh = lastDoneCount;
    // START NEW SIMULATION LOGIC
    let simulationResults: { slopes: number[]; completionDates: string[] } | undefined;
    
    if (forecastConfig.showConfidence) {
        const cycles = forecastConfig.mcCycles || 1000;
        const finalOutcomes: number[] = [];
        const finalSlopes: number[] = [];
        const completionDates: string[] = [];

        // 1. Run Monte Carlo 
        const MAX_SIM_DAYS = 365 * 2; // Reduced to 2 years max projection for performance
        const startDayIndex = new Date(lastDate).getUTCDay(); // 0=Sun, 6=Sat
        
        // Optimization: For CHART confidence intervals (which are critical for UI responsiveness), 100k cycles is overkill if we only need P2.5/P97.5 at day X.
        // But for HISTOGRAM visualization (which has bins), we need density.
        // However, simulating 100k full histories (potentially 700+ days long) is computationally expensive on the main thread (>2s freeze).
        // 
        // Strategy: 
        // If the user requested lots of cycles (>10k), we should cap the inner loop iteration count to prevent freezing.
        // Or we warn the user.
        // Since we can't warn, we'll implement a hybrid approach:
        // Use full cycles for short projections, fewer cycles for long completion.
        // Or simply stick to a lower default like 10,000 for the completion histogram if calculation takes too long?
        // No, let's respect the user's setting but optimize the loop limit.
        // The inner loop break `if (scopeMet && d > projectionDays)` handles most "fast finish" cases.
        // The problem is "slow finish" cases (1000 points remaining, velocity 0-1).
        // If avg velocity is low, we might run 100M iters.
        
        for (let c = 0; c < cycles; c++) {
            let simDone = lastDoneCount;
            let d = 0;
            let finishedDay = -1;
            let scopeMet = false;
            let doneAtProjection = -1;

            // Optimization: If simulation has already finished scope, we can stop the loop early unless we need it for projection match
            // This is CRITICAL for speed: Most runs finish way before 5 years.
            while (d < MAX_SIM_DAYS) {
                // Check exit condition first (after completing scope AND passing chart projection)
                if (scopeMet && d >= projectionDays) break;

                d++;
                
                // Calculate day of week using modulo arithmetic entirely
                // (startDay + d) % 7. 
                // UTC Day: Sun=0, Mon=1... Sat=6.
                const currentDayIndex = (startDayIndex + d) % 7;
                const isWe = (currentDayIndex === 0 || currentDayIndex === 6);

                if (!isWe) {
                     // Pre-fetch random index to avoid Math.floor/random inside if possible?
                     // Actually Math.random is the bottleneck (approx 50-100ns).
                     // 100k * 365 = 36M iterations. 36M * 100ns = 3.6s.
                     // 100k * 1825 = 182M iterations = 18s.
                     // We MUST optimize the "when to stop" or reduce random usage.
                     
                     // Optimization: If we just need to know WHEN it finishes, we effectively sum random variables.
                     // Sum of N random variables ~ Normal distribution (CLT).
                     // But we want the distribution of N (days).
                     // Random Walk First Passage Time?
                     
                     // Practical Optimization: Block processing.
                     // If we are far from scope (remaining > 10 * max_velocity), we can jump 5 days?
                     // Check if min_velocity * 5 would finish it? No.
                     // Just perform 5 adds.
                     // Unrolling the loop?
                     
                     const randomVel = simVelocities[Math.floor(Math.random() * simVelocities.length)];
                     simDone += randomVel;
                }

                if (d === projectionDays) {
                    doneAtProjection = simDone;
                }

                if (!scopeMet && simDone >= totalScope) {
                    finishedDay = d;
                    scopeMet = true;
                }
            }
            
            if (!scopeMet) finishedDay = MAX_SIM_DAYS;
            if (doneAtProjection === -1) doneAtProjection = simDone; // If projection > max

            finalOutcomes.push(doneAtProjection);
            
            if (workDaysInProjection > 0) {
                finalSlopes.push((doneAtProjection - lastDoneCount) / workDaysInProjection);
            } else {
                finalSlopes.push(0);
            }

            const finalDate = new Date(lastDate);
            finalDate.setUTCDate(finalDate.getUTCDate() + finishedDay);
            completionDates.push(finalDate.toISOString().split('T')[0]);
        }
        
        simulationResults = { slopes: finalSlopes, completionDates };
        
        // 2. Sort outcomes to find distribution
        finalOutcomes.sort((a, b) => a - b);
        
        // 3. Find 95% range
        const indexLow = Math.floor(cycles * 0.025);
        const indexHigh = Math.floor(cycles * 0.975);
        
        finalLow = finalOutcomes[indexLow];
        finalHigh = finalOutcomes[indexHigh];
    }
    // END NEW SIMULATION LOGIC

    // Generate linear lines using calculated slopes but respecting weekends
    let currentDone = lastDoneCount;
    const workDayVelocity = avgWorkDayVelocity;
    
    // Helper to track cumulative progress for confidence lines
    let cumSlopeLow = 0;
    let cumSlopeHigh = 0;
    
    // Slopes per WORK DAY (since we only increment on workdays)
    // Avoid division by zero if workDaysInProjection is 0
    let slopeLow = 0;
    let slopeHigh = 0;
    if (workDaysInProjection > 0) {
        slopeLow = (finalLow - lastDoneCount) / workDaysInProjection;
        slopeHigh = (finalHigh - lastDoneCount) / workDaysInProjection;
    }
    
    // Ensure the anchor point has the projected scope value
    if (forecastPoints.length > 0) {
        forecastPoints[0].TotalScopeProjected = totalScope;
    }

    console.log(`Forecasting Loop Start: workDayVelocity=${workDayVelocity}, slopeLow=${slopeLow}, slopeHigh=${slopeHigh}, totalScope=${totalScope}`);

    for (let d = 1; d <= projectionDays; d++) {
        const dateToCheck = new Date(lastDate);
        dateToCheck.setUTCDate(dateToCheck.getUTCDate() + d); 
        
        const isWe = isWeekend(dateToCheck);
        
        if (!isWe) {
            currentDone += workDayVelocity;
            if (forecastConfig.showConfidence) {
                cumSlopeHigh += slopeHigh;
                cumSlopeLow += slopeLow;
            }
        }
        
        // Skip weekend points for drawing, BUT ONLY if we are not at the very end.
        // If we skip plotting, Recharts with connectNulls=true will draw a straight line
        // from Friday to Monday. This is what we want.
        if (isWe) continue; 

        // CRITICAL FIX: Use UTC consistently for the output string
        // addDays uses setUTCDate and returns toISOString().split('T')[0]
        const dateStr = addDays(lastDate, d);
        
        const point: ChartPoint = {
            date: dateStr,
            Forecast: currentDone, 
            TotalScopeProjected: totalScope, // Constant scope line
            ConfidenceHigh: forecastConfig.showConfidence ? lastDoneCount + cumSlopeHigh : undefined,
            ConfidenceLow: forecastConfig.showConfidence ? lastDoneCount + cumSlopeLow : undefined
        };
        
        forecastPoints.push(point);
    }
    
    const finalDateStr = addDays(lastDate, projectionDays);
    const estimatedCompletionDays = avgVelocity > 0 ? (remainingScope / avgVelocity) : -1;
    
    console.log('Forecasting Result Points (Sample):', JSON.stringify(forecastPoints.slice(0, 5).concat(forecastPoints.slice(-5)), null, 2));
    console.log(`Forecasting result: ${forecastPoints.length} points generated. Completion Approx: ${finalDateStr}`);

    return {
        forecastPoints,
        avgVelocity,
        daysToComplete: estimatedCompletionDays,
        completionDate: avgVelocity > 0 ? finalDateStr : null,
        simulationResults
    };
};

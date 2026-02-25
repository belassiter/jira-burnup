
import { describe, it, expect } from 'vitest';
import { generateForecast, ChartPoint } from './forecasting';
import { ForecastConfig, StatusConfig } from '../types';

describe('forecasting', () => {
    const statusConfigs: StatusConfig[] = [
        { name: 'Done', category: 'done', enabled: true, color: 'green' },
        { name: 'Todo', category: 'not-started', enabled: true, color: 'grey' }
    ];

    it('should return null if not enough data', () => {
        const data: ChartPoint[] = [{ date: '2023-01-01', Done: 5, Todo: 10 }];
        const config: ForecastConfig = { enabled: true, avgDatapoints: 3, showConfidence: false, mcCycles: 100 };
        const result = generateForecast(data, config, statusConfigs);
        expect(result).toBeNull();
    });

    it('should return null if forecasting disabled', () => {
        const data: ChartPoint[] = [
            { date: '2023-01-01', Done: 5, Todo: 10 },
            { date: '2023-01-02', Done: 6, Todo: 9 }
        ];
        const config: ForecastConfig = { enabled: false, avgDatapoints: 3, showConfidence: false, mcCycles: 100 };
        const result = generateForecast(data, config, statusConfigs);
        expect(result).toBeNull();
    });

    it('should generate a forecast with positive velocity', () => {
        const data: ChartPoint[] = [
            { date: '2023-01-01', Done: 5, Todo: 10 },
            { date: '2023-01-02', Done: 6, Todo: 9 }
        ];
        const config: ForecastConfig = { enabled: true, avgDatapoints: 3, showConfidence: false, mcCycles: 100 };
        const result = generateForecast(data, config, statusConfigs);
        expect(result).not.toBeNull();
        expect(result?.avgVelocity).toBeGreaterThan(0);
        expect(result?.forecastPoints.length).toBeGreaterThan(1);
    });

    it('should generate a flat forecast line when velocity is zero and work remains', () => {
        const data: ChartPoint[] = [
            { date: '2023-01-01', Done: 5, Todo: 10 },
            { date: '2023-01-02', Done: 5, Todo: 10 } // No progress
        ];
        // 2 points, no change -> velocity 0
        const config: ForecastConfig = { enabled: true, avgDatapoints: 3, showConfidence: false, mcCycles: 100 };
        const result = generateForecast(data, config, statusConfigs);
        
        expect(result).not.toBeNull();
        if (result) {
            expect(result.avgVelocity).toBe(0);
            expect(result.daysToComplete).toBe(Infinity);
            // Before fix, length would be 1 (only anchor). After fix, should be 1 + 14 = 15
            expect(result.forecastPoints.length).toBeGreaterThan(1);
            expect(result.forecastPoints[1].Forecast).toBe(5); // Should remain flat
        }
    });

    it('should generate a flat forecast line when velocity is negative (reverting work)', () => {
         const data: ChartPoint[] = [
            { date: '2023-01-01', Done: 5, Todo: 10 },
            { date: '2023-01-02', Done: 4, Todo: 11 } // Negative progress
        ];
        const config: ForecastConfig = { enabled: true, avgDatapoints: 3, showConfidence: false, mcCycles: 100 };
        const result = generateForecast(data, config, statusConfigs);
        
        expect(result).not.toBeNull();
        if (result) {
            expect(result.avgVelocity).toBeLessThan(0);
            expect(result.daysToComplete).toBe(Infinity);
             // Should project a flat line (last known value) rather than negative projection
            expect(result.forecastPoints.length).toBeGreaterThan(1);
            expect(result.forecastPoints[1].Forecast).toBe(4); // Last known done count
        }
    });

    it('should generate a flat forecast line when scope is completed', () => {
        const data: ChartPoint[] = [
            { date: '2024-01-01', Done: 4, Todo: 0 },
            { date: '2024-01-02', Done: 5, Todo: 0 } // Completed
        ];
        const config: ForecastConfig = { enabled: true, avgDatapoints: 3, showConfidence: false, mcCycles: 100 };
        const result = generateForecast(data, config, statusConfigs);
        
        expect(result).not.toBeNull();
        if (result) {
            expect(result.daysToComplete).toBe(0);
             // Should project a flat line to indicate "Done" visually
            expect(result.forecastPoints.length).toBeGreaterThan(1);
            expect(result.forecastPoints[1].Forecast).toBe(5); // Last known done count
        }
    });
});

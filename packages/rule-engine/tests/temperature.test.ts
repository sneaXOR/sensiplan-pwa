/**
 * Tests unitaires pour les règles de température
 * 
 * Basés sur les exemples du document SensiPlan (doc.txt)
 */

import { describe, it, expect } from 'vitest';
import {
    evaluateTemperatureShift,
    getValidTemperatures,
} from '../src/temperature';
import { DailyEntry } from '../src/types';

// Fonction utilitaire pour créer des entrées de test
function createEntry(cycleDay: number, temperature?: number, excluded = false): DailyEntry {
    return {
        id: `day-${cycleDay}`,
        date: `2024-01-${String(cycleDay).padStart(2, '0')}`,
        cycleId: 'test-cycle',
        cycleDay,
        temperature,
        temperatureMethod: 'oral',
        temperatureExcluded: excluded,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

describe('Temperature Rules', () => {
    describe('getValidTemperatures', () => {
        it('should filter out excluded temperatures', () => {
            const entries = [
                createEntry(1, 36.3),
                createEntry(2, 36.5, true), // excluded
                createEntry(3, 36.4),
            ];

            const valid = getValidTemperatures(entries);

            expect(valid).toHaveLength(2);
            expect(valid[0]).toEqual({ day: 1, temp: 36.3 });
            expect(valid[1]).toEqual({ day: 3, temp: 36.4 });
        });

        it('should filter out entries without temperature', () => {
            const entries = [
                createEntry(1, 36.3),
                createEntry(2, undefined),
                createEntry(3, 36.4),
            ];

            const valid = getValidTemperatures(entries);

            expect(valid).toHaveLength(2);
        });
    });

    describe('evaluateTemperatureShift - Main Rule', () => {
        it('should detect a valid temperature shift', () => {
            // 6 low temps followed by 3 high temps (3rd >= 0.2°C above coverline)
            const entries = [
                createEntry(1, 36.3),
                createEntry(2, 36.4),
                createEntry(3, 36.35),
                createEntry(4, 36.38),
                createEntry(5, 36.32),
                createEntry(6, 36.4), // Coverline = 36.4
                createEntry(7, 36.5), // 1st high
                createEntry(8, 36.55), // 2nd high
                createEntry(9, 36.65), // 3rd high (0.25 above coverline ✓)
            ];

            const result = evaluateTemperatureShift(entries);

            expect(result.isShiftComplete).toBe(true);
            expect(result.coverLineTemp).toBe(36.4);
            expect(result.higherTempDays).toEqual([7, 8, 9]);
            expect(result.exceptionUsed).toBe('none');
        });

        it('should not detect shift if 3rd temp is not high enough', () => {
            // 3rd temp not 0.2°C above coverline
            const entries = [
                createEntry(1, 36.3),
                createEntry(2, 36.4),
                createEntry(3, 36.35),
                createEntry(4, 36.38),
                createEntry(5, 36.32),
                createEntry(6, 36.4), // Coverline = 36.4
                createEntry(7, 36.5), // 1st high
                createEntry(8, 36.55), // 2nd high
                createEntry(9, 36.55), // 3rd high (only 0.15 above - not enough)
            ];

            const result = evaluateTemperatureShift(entries);

            // Should try exception 1 (4th temp) but no 4th temp available
            expect(result.isShiftComplete).toBe(false);
        });

        it('should return cannotEvaluate with insufficient data', () => {
            const entries = [
                createEntry(1, 36.3),
                createEntry(2, 36.4),
                createEntry(3, 36.35),
            ];

            const result = evaluateTemperatureShift(entries);

            expect(result.cannotEvaluate).toBe(true);
        });
    });

    describe('evaluateTemperatureShift - Exception 1 (4th temp)', () => {
        it('should use 4th temperature when 3rd is not high enough', () => {
            const entries = [
                createEntry(1, 36.3),
                createEntry(2, 36.4),
                createEntry(3, 36.35),
                createEntry(4, 36.38),
                createEntry(5, 36.32),
                createEntry(6, 36.4), // Coverline = 36.4
                createEntry(7, 36.5), // 1st high
                createEntry(8, 36.55), // 2nd high
                createEntry(9, 36.55), // 3rd high (not 0.2 above)
                createEntry(10, 36.5), // 4th high (above coverline ✓)
            ];

            const result = evaluateTemperatureShift(entries);

            expect(result.isShiftComplete).toBe(true);
            expect(result.exceptionUsed).toBe('first');
            expect(result.higherTempDays).toHaveLength(4);
        });
    });

    describe('evaluateTemperatureShift - Exception 2 (1 below coverline)', () => {
        it('should allow 1 temp on/below coverline if 3rd is high enough', () => {
            const entries = [
                createEntry(1, 36.3),
                createEntry(2, 36.4),
                createEntry(3, 36.35),
                createEntry(4, 36.38),
                createEntry(5, 36.32),
                createEntry(6, 36.4), // Coverline = 36.4
                createEntry(7, 36.5), // 1st high
                createEntry(8, 36.38), // 2nd ON/BELOW coverline
                createEntry(9, 36.65), // 3rd high (0.25 above ✓)
            ];

            const result = evaluateTemperatureShift(entries);

            expect(result.isShiftComplete).toBe(true);
            expect(result.exceptionUsed).toBe('second');
            // Day 8 should not be counted
            expect(result.higherTempDays).not.toContain(8);
        });

        it('should not allow more than 1 temp below coverline', () => {
            const entries = [
                createEntry(1, 36.3),
                createEntry(2, 36.4),
                createEntry(3, 36.35),
                createEntry(4, 36.38),
                createEntry(5, 36.32),
                createEntry(6, 36.4), // Coverline = 36.4
                createEntry(7, 36.38), // BELOW coverline
                createEntry(8, 36.35), // BELOW coverline
                createEntry(9, 36.65), // High
            ];

            const result = evaluateTemperatureShift(entries);

            expect(result.isShiftComplete).toBe(false);
        });
    });

    describe('evaluateTemperatureShift - Excluded temperatures', () => {
        it('should skip excluded temperatures in evaluation', () => {
            const entries = [
                createEntry(1, 36.3),
                createEntry(2, 36.4),
                createEntry(3, 36.35),
                createEntry(4, 36.38),
                createEntry(5, 36.32),
                createEntry(6, 36.4),
                createEntry(7, 36.5),
                createEntry(8, 36.9, true), // EXCLUDED - disturbance
                createEntry(9, 36.55),
                createEntry(10, 36.65),
            ];

            const result = evaluateTemperatureShift(entries);

            // Day 8 is excluded, so days 7, 9, 10 should be the 3 high temps
            expect(result.isShiftComplete).toBe(true);
            expect(result.higherTempDays).not.toContain(8);
        });
    });
});

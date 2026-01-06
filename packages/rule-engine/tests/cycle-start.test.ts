/**
 * Tests unitaires pour les règles de début de cycle
 */

import { describe, it, expect } from 'vitest';
import {
    applyFiveDayRule,
    applyMinus8Rule,
    applyMinus20Rule,
    canUseFiveDayRule,
    determineCycleStart,
    adjustForMucus,
} from '../src/cycle-start';
import { DailyEntry, UserProfile, MucusCategory } from '../src/types';

// Fonctions utilitaires pour créer des données de test
function createEntry(cycleDay: number, mucus?: MucusCategory): DailyEntry {
    return {
        id: `day-${cycleDay}`,
        date: `2024-01-${String(cycleDay).padStart(2, '0')}`,
        cycleId: 'test-cycle',
        cycleDay,
        mucusObservation: mucus,
        temperatureMethod: 'oral',
        temperatureExcluded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

function createProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    return {
        language: 'fr',
        temperatureMethod: 'oral',
        useCervixSign: false,
        earliestFirstHigherTemps: [],
        createdAt: new Date().toISOString(),
        cycleCount: 0,
        ...overrides,
    };
}

describe('Cycle Start Rules', () => {
    describe('applyFiveDayRule', () => {
        it('should return 5 if no mucus in first 5 days', () => {
            const entries = [
                createEntry(1, 'd'),
                createEntry(2, 'd'),
                createEntry(3, 'd'),
                createEntry(4),
                createEntry(5, 'd'),
            ];

            expect(applyFiveDayRule(entries)).toBe(5);
        });

        it('should return day before mucus if mucus observed', () => {
            const entries = [
                createEntry(1, 'd'),
                createEntry(2, 'd'),
                createEntry(3, 'm'), // Mucus on day 3
                createEntry(4, 'S'),
                createEntry(5, 'S'),
            ];

            expect(applyFiveDayRule(entries)).toBe(2);
        });

        it('should return 0 if mucus on day 1', () => {
            const entries = [
                createEntry(1, 'm'), // Mucus on day 1
                createEntry(2, 'S'),
            ];

            expect(applyFiveDayRule(entries)).toBe(0);
        });

        it('should treat ø as fertility indicator', () => {
            const entries = [
                createEntry(1, 'd'),
                createEntry(2, 'd'),
                createEntry(3, 'ø'), // "Nothing" but different from "dry"
            ];

            expect(applyFiveDayRule(entries)).toBe(2);
        });
    });

    describe('canUseFiveDayRule', () => {
        it('should return true for new users', () => {
            const profile = createProfile({ cycleCount: 0 });
            expect(canUseFiveDayRule(profile)).toBe(true);
        });

        it('should return false after 12 cycles', () => {
            const profile = createProfile({ cycleCount: 12 });
            expect(canUseFiveDayRule(profile)).toBe(false);
        });

        it('should return false if any first higher temp was ≤ day 12', () => {
            const profile = createProfile({
                cycleCount: 5,
                earliestFirstHigherTemps: [14, 15, 12], // Day 12 triggers Minus-8
            });
            expect(canUseFiveDayRule(profile)).toBe(false);
        });

        it('should return true if all first higher temps > day 12', () => {
            const profile = createProfile({
                cycleCount: 5,
                earliestFirstHigherTemps: [14, 15, 16],
            });
            expect(canUseFiveDayRule(profile)).toBe(true);
        });
    });

    describe('applyMinus8Rule', () => {
        it('should return earliest - 8', () => {
            const profile = createProfile({
                cycleCount: 12,
                earliestFirstHigherTemps: [14, 15, 16, 13, 14, 15, 14, 13, 14, 15, 14, 13],
            });

            // Earliest is 13, so 13 - 8 = 5
            expect(applyMinus8Rule(profile)).toBe(5);
        });

        it('should return 0 if result would be negative', () => {
            const profile = createProfile({
                cycleCount: 12,
                earliestFirstHigherTemps: Array(12).fill(7), // 7 - 8 = -1 → 0
            });

            expect(applyMinus8Rule(profile)).toBe(0);
        });

        it('should return null if less than 12 cycles and no early temp', () => {
            const profile = createProfile({
                cycleCount: 5,
                earliestFirstHigherTemps: [14, 15, 16, 17, 18],
            });

            expect(applyMinus8Rule(profile)).toBeNull();
        });

        it('should use Minus-8 if early temp detected (≤12) even with <12 cycles', () => {
            const profile = createProfile({
                cycleCount: 3,
                earliestFirstHigherTemps: [11, 14, 15], // 11 ≤ 12
            });

            // Earliest is 11, so 11 - 8 = 3
            expect(applyMinus8Rule(profile)).toBe(3);
        });
    });

    describe('applyMinus20Rule', () => {
        it('should return shortest cycle - 20', () => {
            expect(applyMinus20Rule(28)).toBe(8);  // 28 - 20 = 8
            expect(applyMinus20Rule(30)).toBe(10); // 30 - 20 = 10
            expect(applyMinus20Rule(25)).toBe(5);  // 25 - 20 = 5
        });

        it('should return 0 for very short cycles', () => {
            expect(applyMinus20Rule(20)).toBe(0);
            expect(applyMinus20Rule(18)).toBe(0);
        });
    });

    describe('adjustForMucus', () => {
        it('should adjust if mucus observed before calculated day', () => {
            const entries = [
                createEntry(1, 'd'),
                createEntry(2, 'd'),
                createEntry(3, 'm'), // Mucus
            ];

            // Minus-8 says day 5, but mucus on day 3
            expect(adjustForMucus(5, entries)).toBe(2);
        });

        it('should not adjust if mucus after calculated day', () => {
            const entries = [
                createEntry(1, 'd'),
                createEntry(2, 'd'),
                createEntry(3, 'd'),
                createEntry(4, 'd'),
                createEntry(5, 'd'),
                createEntry(6, 'm'), // Mucus after day 5
            ];

            expect(adjustForMucus(5, entries)).toBe(5);
        });
    });

    describe('determineCycleStart', () => {
        it('should use 5-day rule for new users', () => {
            const profile = createProfile({ cycleCount: 0 });
            const entries = [createEntry(1, 'd'), createEntry(2, 'd')];

            const result = determineCycleStart(profile, entries);

            expect(result.rule).toBe('five-day');
            expect(result.lastInfertileDay).toBe(5);
            expect(result.fertilityStartsDay).toBe(6);
        });

        it('should use Minus-8 after 12 cycles', () => {
            const profile = createProfile({
                cycleCount: 12,
                earliestFirstHigherTemps: Array(12).fill(14), // All day 14
            });
            const entries = [createEntry(1, 'd')];

            const result = determineCycleStart(profile, entries);

            expect(result.rule).toBe('minus-8');
            expect(result.lastInfertileDay).toBe(6); // 14 - 8 = 6
        });

        it('should use Minus-20 if available and better than 5-day', () => {
            const profile = createProfile({
                cycleCount: 3,
                earliestFirstHigherTemps: [18, 19, 20], // All > 12
                shortestCycleLength: 28, // 28 - 20 = 8 > 5
            });
            const entries = [createEntry(1, 'd')];

            const result = determineCycleStart(profile, entries);

            expect(result.rule).toBe('minus-20');
            expect(result.lastInfertileDay).toBe(8);
        });

        it('should override with mucus regardless of rule', () => {
            const profile = createProfile({
                cycleCount: 12,
                earliestFirstHigherTemps: Array(12).fill(14), // Minus-8 = day 6
            });
            const entries = [
                createEntry(1, 'd'),
                createEntry(2, 'd'),
                createEntry(3, 'm'), // Mucus on day 3 overrides
            ];

            const result = determineCycleStart(profile, entries);

            expect(result.lastInfertileDay).toBe(2); // Day before mucus
            expect(result.fertilityStartsDay).toBe(3);
        });
    });
});

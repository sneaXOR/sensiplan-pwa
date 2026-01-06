/**
 * Tests unitaires pour les règles de glaire cervicale
 */

import { describe, it, expect } from 'vitest';
import {
    evaluateMucusShift,
    findPeakDay,
    compareMucusQuality,
    getMucusObservations,
    mucusIndicatesFertility,
} from '../src/mucus';
import { DailyEntry, MucusCategory } from '../src/types';

// Fonction utilitaire pour créer des entrées de test
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

describe('Mucus Rules', () => {
    describe('compareMucusQuality', () => {
        it('should compare mucus categories correctly', () => {
            expect(compareMucusQuality('d', 'S+')).toBeLessThan(0);
            expect(compareMucusQuality('S+', 'd')).toBeGreaterThan(0);
            expect(compareMucusQuality('S', 'S')).toBe(0);
            expect(compareMucusQuality('m', 'S')).toBeLessThan(0);
            expect(compareMucusQuality('ø', 'm')).toBeLessThan(0);
        });

        it('should order categories: d < ø < m < S < S+', () => {
            const categories: MucusCategory[] = ['d', 'ø', 'm', 'S', 'S+'];
            for (let i = 0; i < categories.length - 1; i++) {
                expect(compareMucusQuality(categories[i], categories[i + 1])).toBeLessThan(0);
            }
        });
    });

    describe('getMucusObservations', () => {
        it('should extract mucus observations and sort by day', () => {
            const entries = [
                createEntry(3, 'S'),
                createEntry(1, 'd'),
                createEntry(2, undefined), // no observation
                createEntry(4, 'S+'),
            ];

            const obs = getMucusObservations(entries);

            expect(obs).toHaveLength(3);
            expect(obs[0]).toEqual({ day: 1, mucus: 'd' });
            expect(obs[1]).toEqual({ day: 3, mucus: 'S' });
            expect(obs[2]).toEqual({ day: 4, mucus: 'S+' });
        });
    });

    describe('findPeakDay', () => {
        it('should find peak day when quality declines', () => {
            // Example from Figure 16 (doc.txt line 1727)
            const entries = [
                createEntry(10, 'd'),
                createEntry(11, 'm'),
                createEntry(12, 'S'),
                createEntry(13, 'S+'),
                createEntry(14, 'S+'),
                createEntry(15, 'S+'), // Peak
                createEntry(16, 'S'),  // Decline
                createEntry(17, 'm'),
            ];

            const peakDay = findPeakDay(entries);

            expect(peakDay).toBe(15);
        });

        it('should find peak day with S category only (no S+)', () => {
            // Example from Figure 17 (doc.txt line 1843)
            const entries = [
                createEntry(5, 'd'),
                createEntry(6, 'm'),
                createEntry(7, 'm'),
                createEntry(8, 'S'),
                createEntry(9, 'S'),
                createEntry(10, 'S'),
                createEntry(11, 'S'),
                createEntry(12, 'S'),
                createEntry(13, 'S'), // Peak
                createEntry(14, 'd'), // Decline
                createEntry(15, 'd'),
            ];

            const peakDay = findPeakDay(entries);

            expect(peakDay).toBe(13);
        });

        it('should return null if no decline observed', () => {
            const entries = [
                createEntry(10, 'm'),
                createEntry(11, 'S'),
                createEntry(12, 'S+'),
                createEntry(13, 'S+'),
                // No decline yet
            ];

            const peakDay = findPeakDay(entries);

            expect(peakDay).toBeNull();
        });

        it('should return null with insufficient data', () => {
            const entries = [createEntry(1, 'S')];
            expect(findPeakDay(entries)).toBeNull();
        });
    });

    describe('evaluateMucusShift', () => {
        it('should complete shift after P+3 with lower quality', () => {
            const entries = [
                createEntry(12, 'S+'),
                createEntry(13, 'S+'),
                createEntry(14, 'S+'), // Peak
                createEntry(15, 'S'),  // P+1
                createEntry(16, 'm'),  // P+2
                createEntry(17, 'd'),  // P+3
            ];

            const result = evaluateMucusShift(entries);

            expect(result.peakDay).toBe(14);
            expect(result.isShiftComplete).toBe(true);
            expect(result.postPeakCount).toBe(3);
            expect(result.peakQualityReturned).toBe(false);
        });

        it('should restart count if quality returns to peak', () => {
            // Example from Figure 38 (doc.txt line 2807)
            const entries = [
                createEntry(10, 'S+'),
                createEntry(11, 'S+'), // First peak candidate
                createEntry(12, 'S'),  // P+1
                createEntry(13, 'S'),  // P+2
                createEntry(14, 'S+'), // Return to peak quality!
                createEntry(15, 'S+'),
                createEntry(16, 'S'),  // New P+1
                createEntry(17, 'm'),  // New P+2
                createEntry(18, 'd'),  // New P+3
            ];

            const result = evaluateMucusShift(entries);

            // The first peak at day 11 should be invalidated
            // New peak is at day 15
            expect(result.peakQualityReturned).toBe(true);
        });

        it('should not complete if less than 3 days after peak', () => {
            const entries = [
                createEntry(12, 'S+'),
                createEntry(13, 'S+'), // Peak
                createEntry(14, 'S'),  // P+1
                createEntry(15, 'm'),  // P+2
                // Missing P+3
            ];

            const result = evaluateMucusShift(entries);

            expect(result.isShiftComplete).toBe(false);
            expect(result.postPeakCount).toBe(2);
        });
    });

    describe('mucusIndicatesFertility', () => {
        it('should return false for dry (d)', () => {
            const entry = createEntry(5, 'd');
            expect(mucusIndicatesFertility(entry)).toBe(false);
        });

        it('should return true for any other category', () => {
            expect(mucusIndicatesFertility(createEntry(5, 'ø'))).toBe(true);
            expect(mucusIndicatesFertility(createEntry(5, 'm'))).toBe(true);
            expect(mucusIndicatesFertility(createEntry(5, 'S'))).toBe(true);
            expect(mucusIndicatesFertility(createEntry(5, 'S+'))).toBe(true);
        });

        it('should return false if no observation', () => {
            const entry = createEntry(5, undefined);
            expect(mucusIndicatesFertility(entry)).toBe(false);
        });
    });
});

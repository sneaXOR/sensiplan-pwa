/**
 * SensiPlan PWA - Configuration IndexedDB via Dexie
 * 
 * Stockage local offline-first pour les données de fertilité.
 */

import Dexie, { Table } from 'dexie';
import type { DailyEntry, Cycle, UserProfile } from '@sensiplan/rule-engine';

// Version de la base de données (incrémenter pour les migrations)
const DB_VERSION = 1;

/**
 * Base de données SensiPlan
 */
export class SensiplanDB extends Dexie {
    entries!: Table<DailyEntry>;
    cycles!: Table<Cycle>;
    profile!: Table<UserProfile>;

    constructor() {
        super('sensiplan');

        this.version(DB_VERSION).stores({
            entries: 'id, date, cycleId, cycleDay',
            cycles: 'id, startDate, endDate, cycleNumber',
            profile: 'id',
        });
    }
}

// Instance singleton de la base de données
export const db = new SensiplanDB();

// ============================================================================
// PROFIL UTILISATEUR
// ============================================================================

const DEFAULT_PROFILE_ID = 'default';

/**
 * Récupère ou crée le profil utilisateur par défaut
 */
export async function getOrCreateProfile(): Promise<UserProfile> {
    const existing = await db.profile.get(DEFAULT_PROFILE_ID);

    if (existing) {
        return existing;
    }

    const newProfile: UserProfile & { id: string } = {
        id: DEFAULT_PROFILE_ID,
        language: 'fr',
        temperatureMethod: 'oral',
        useCervixSign: false,
        earliestFirstHigherTemps: [],
        createdAt: new Date().toISOString(),
        cycleCount: 0,
    };

    await db.profile.add(newProfile);
    return newProfile;
}

/**
 * Met à jour le profil utilisateur
 */
export async function updateProfile(updates: Partial<UserProfile>): Promise<void> {
    await db.profile.update(DEFAULT_PROFILE_ID, updates);
}

// ============================================================================
// CYCLES
// ============================================================================

/**
 * Récupère le cycle en cours (sans date de fin)
 */
export async function getCurrentCycle(): Promise<Cycle | undefined> {
    return db.cycles.filter(c => !c.endDate).first();
}

/**
 * Crée un nouveau cycle
 */
export async function createCycle(startDate: string): Promise<Cycle> {
    const profile = await getOrCreateProfile();

    // Fermer le cycle précédent s'il existe
    const previousCycle = await getCurrentCycle();
    if (previousCycle) {
        const previousDayDate = new Date(startDate);
        previousDayDate.setDate(previousDayDate.getDate() - 1);
        await db.cycles.update(previousCycle.id, {
            endDate: previousDayDate.toISOString().split('T')[0],
        });
    }

    const newCycle: Cycle = {
        id: crypto.randomUUID(),
        startDate,
        temperatureShiftComplete: false,
        mucusShiftComplete: false,
        ruleApplied: profile.cycleCount >= 12 ? 'minus-8' : 'five-day',
        isFirst12Cycles: profile.cycleCount < 12,
        cycleNumber: profile.cycleCount + 1,
    };

    await db.cycles.add(newCycle);
    await updateProfile({ cycleCount: profile.cycleCount + 1 });

    return newCycle;
}

/**
 * Récupère tous les cycles triés par date de début
 */
export async function getAllCycles(): Promise<Cycle[]> {
    return db.cycles.orderBy('startDate').reverse().toArray();
}

/**
 * Met à jour un cycle
 */
export async function updateCycle(id: string, updates: Partial<Cycle>): Promise<void> {
    await db.cycles.update(id, updates);
}

// ============================================================================
// ENTRÉES QUOTIDIENNES
// ============================================================================

/**
 * Récupère une entrée par date
 */
export async function getEntryByDate(date: string): Promise<DailyEntry | undefined> {
    return db.entries.where('date').equals(date).first();
}

/**
 * Récupère toutes les entrées d'un cycle
 */
export async function getEntriesByCycle(cycleId: string): Promise<DailyEntry[]> {
    return db.entries.where('cycleId').equals(cycleId).sortBy('cycleDay');
}

/**
 * Crée ou met à jour une entrée (une seule entrée par date)
 */
export async function saveEntry(entry: DailyEntry): Promise<void> {
    // Chercher par date pour éviter les doublons
    const existing = await db.entries.where('date').equals(entry.date).first();

    if (existing) {
        // Toujours utiliser l'ID existant pour éviter les doublons
        await db.entries.update(existing.id, {
            ...entry,
            id: existing.id, // Garder l'ID original
            createdAt: existing.createdAt, // Garder la date de création originale
            updatedAt: new Date().toISOString(),
        });
    } else {
        await db.entries.add({
            ...entry,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }
}

/**
 * Calcule le jour du cycle pour une date donnée
 */
export function calculateCycleDay(cycleStartDate: string, date: string): number {
    const start = new Date(cycleStartDate);
    const current = new Date(date);
    const diffTime = current.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const cycleDay = diffDays + 1; // 1-indexed
    return cycleDay > 0 ? cycleDay : 0; // Prevent negative cycle days
}

// ============================================================================
// EXPORT / IMPORT
// ============================================================================

export interface ExportData {
    version: '1.0';
    exportDate: string;
    profile: UserProfile;
    cycles: Cycle[];
    entries: DailyEntry[];
}

/**
 * Exporte toutes les données
 */
export async function exportData(): Promise<ExportData> {
    const profile = await getOrCreateProfile();
    const cycles = await db.cycles.toArray();
    const entries = await db.entries.toArray();

    return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        profile,
        cycles,
        entries,
    };
}

/**
 * Importe des données (écrase les existantes)
 */
export async function importData(data: ExportData): Promise<void> {
    // Valider le format
    if (data.version !== '1.0') {
        throw new Error('Format de fichier non supporté');
    }

    // Effacer les données existantes
    await db.entries.clear();
    await db.cycles.clear();
    await db.profile.clear();

    // Importer les nouvelles données
    if (data.profile) {
        await db.profile.add({ ...data.profile, id: DEFAULT_PROFILE_ID } as UserProfile & { id: string });
    }

    if (data.cycles && data.cycles.length > 0) {
        await db.cycles.bulkAdd(data.cycles);
    }

    if (data.entries && data.entries.length > 0) {
        await db.entries.bulkAdd(data.entries);
    }
}

/**
 * Supprime toutes les données
 */
export async function deleteAllData(): Promise<void> {
    await db.entries.clear();
    await db.cycles.clear();
    await db.profile.clear();
}

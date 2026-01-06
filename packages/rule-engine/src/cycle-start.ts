/**
 * SensiPlan Rule Engine - Règles de Début de Cycle
 * 
 * Implémentation des règles pour déterminer la période infertile
 * au début du cycle (avant ovulation).
 * 
 * Source: doc.txt lignes 2899-3028, 3136-3154
 */

import {
    Cycle,
    UserProfile,
    DailyEntry,
    CycleStartRule,
    RuleReference,
} from './types';
import { mucusIndicatesFertility } from './mucus';

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Nombre de jours infertiles par défaut (règle des 5 jours)
 * Source: doc.txt ligne 3015 "The first 5 cycle days are assumed to be infertile"
 */
const FIVE_DAY_RULE_DAYS = 5;

/**
 * Nombre de jours à soustraire pour Minus-8
 * Source: doc.txt ligne 2919-2920 "minus 8 days"
 */
const MINUS_8_OFFSET = 8;

/**
 * Nombre de jours à soustraire pour Minus-20
 * Source: doc.txt ligne 3143-3144 "minus 20"
 */
const MINUS_20_OFFSET = 20;

/**
 * Nombre minimum de cycles pour utiliser Minus-8
 * Source: doc.txt ligne 2918 "at least 12 previous cycles"
 */
const MIN_CYCLES_FOR_MINUS_8 = 12;

/**
 * Jour seuil pour passer de 5-day à Minus-8
 * Source: doc.txt ligne 3018-3019 "on or before cycle day 12"
 */
const TRANSITION_THRESHOLD_DAY = 12;

// ============================================================================
// RÈGLE DES 5 JOURS (Débutantes)
// Source: doc.txt lignes 3008-3028
// ============================================================================

/**
 * Applique la règle des 5 jours pour les débutantes
 * 
 * Règle:
 * - Les 5 premiers jours sont infertiles
 * - SAUF si glaire observée avant
 * 
 * @param entries - Entrées du cycle en cours
 * @returns Dernier jour infertile (1-5) ou 0 si glaire vue immédiatement
 */
export function applyFiveDayRule(entries: DailyEntry[]): number {
    // Vérifier si glaire observée dans les 5 premiers jours
    for (const entry of entries) {
        if (entry.cycleDay <= FIVE_DAY_RULE_DAYS) {
            if (mucusIndicatesFertility(entry)) {
                // Fertilité commence immédiatement le jour précédent était le dernier infertile
                return Math.max(0, entry.cycleDay - 1);
            }
        }
    }

    return FIVE_DAY_RULE_DAYS;
}

/**
 * Vérifie si la règle des 5 jours est toujours applicable
 * 
 * Source: doc.txt lignes 3018-3021
 * "If in any of your first 12 cycles the earliest first higher temperature 
 *  reading has ever been on or before cycle day 12, the 5-Day Rule no longer applies"
 * 
 * @param profile - Profil utilisateur avec historique
 * @returns true si 5-day rule s'applique encore
 */
export function canUseFiveDayRule(profile: UserProfile): boolean {
    if (profile.cycleCount >= MIN_CYCLES_FOR_MINUS_8) {
        // Après 12 cycles, utiliser Minus-8
        return false;
    }

    // Vérifier si une première temp haute a été ≤ jour 12
    const hasEarlyTemp = profile.earliestFirstHigherTemps.some(
        day => day <= TRANSITION_THRESHOLD_DAY
    );

    if (hasEarlyTemp) {
        // Transition vers Minus-8
        return false;
    }

    return true;
}

// ============================================================================
// RÈGLE MINUS-8
// Source: doc.txt lignes 2909-2928
// ============================================================================

/**
 * Calcule le dernier jour infertile selon la règle Minus-8
 * 
 * Règle:
 * - Premier jour de temp haute le plus précoce (sur 12+ cycles) - 8
 * - SAUF si glaire observée avant
 * 
 * @param profile - Profil utilisateur avec historique des 12+ cycles
 * @returns Dernier jour infertile ou null si pas applicable
 */
export function applyMinus8Rule(profile: UserProfile): number | null {
    if (profile.earliestFirstHigherTemps.length < MIN_CYCLES_FOR_MINUS_8 &&
        !profile.earliestFirstHigherTemps.some(d => d <= TRANSITION_THRESHOLD_DAY)) {
        return null;
    }

    // Trouver le jour le plus précoce
    const earliestDay = Math.min(...profile.earliestFirstHigherTemps);

    // Calculer le dernier jour infertile
    const lastInfertileDay = earliestDay - MINUS_8_OFFSET;

    // Le minimum est jour 0 (pas de jours infertiles)
    return Math.max(0, lastInfertileDay);
}

/**
 * Ajuste le dernier jour infertile si glaire observée avant
 * 
 * Source: doc.txt ligne 2921-2923
 * "If you observe cervical mucus or feel 'moist' before this day,
 *  the fertile phase starts immediately"
 * 
 * @param lastInfertileDay - Jour calculé par Minus-8
 * @param entries - Entrées du cycle en cours
 * @returns Jour ajusté
 */
export function adjustForMucus(
    lastInfertileDay: number,
    entries: DailyEntry[]
): number {
    for (const entry of entries) {
        if (entry.cycleDay <= lastInfertileDay) {
            if (mucusIndicatesFertility(entry)) {
                return Math.max(0, entry.cycleDay - 1);
            }
        }
    }

    return lastInfertileDay;
}

// ============================================================================
// RÈGLE MINUS-20 (Calendrier menstruel)
// Source: doc.txt lignes 3136-3154
// ============================================================================

/**
 * Calcule le dernier jour infertile selon la règle Minus-20
 * 
 * Règle spéciale pour celles qui ont un calendrier menstruel de 12+ cycles
 * mais pas encore 12 cycles SensiPlan.
 * 
 * @param shortestCycleLength - Durée du cycle le plus court
 * @returns Dernier jour infertile
 */
export function applyMinus20Rule(shortestCycleLength: number): number {
    const lastInfertileDay = shortestCycleLength - MINUS_20_OFFSET;
    return Math.max(0, lastInfertileDay);
}

// ============================================================================
// FONCTION PRINCIPALE: DÉTERMINER LA RÈGLE APPLICABLE
// ============================================================================

export interface CycleStartResult {
    rule: CycleStartRule;
    lastInfertileDay: number;
    fertilityStartsDay: number; // lastInfertileDay + 1
}

/**
 * Détermine quelle règle appliquer et calcule le début de la fertilité
 * 
 * Priorité:
 * 1. Si Minus-8 donne un jour plus précoce que 5-day, utiliser Minus-8
 * 2. Si 12+ cycles Sensiplan, utiliser Minus-8
 * 3. Si calendrier menstruel disponible et Minus-20 > 5 jours, utiliser Minus-20
 * 4. Sinon, utiliser 5-day rule
 * 
 * Dans tous les cas, la glaire prime (double-check)
 * 
 * @param profile - Profil utilisateur
 * @param entries - Entrées du cycle en cours
 * @returns Résultat avec règle appliquée et jours
 */
export function determineCycleStart(
    profile: UserProfile,
    entries: DailyEntry[]
): CycleStartResult {
    let rule: CycleStartRule = 'five-day';
    let lastInfertileDay = FIVE_DAY_RULE_DAYS;

    // Essayer Minus-8
    const minus8Day = applyMinus8Rule(profile);
    if (minus8Day !== null) {
        rule = 'minus-8';
        lastInfertileDay = minus8Day;
    } else if (canUseFiveDayRule(profile)) {
        // Règle des 5 jours
        rule = 'five-day';
        lastInfertileDay = FIVE_DAY_RULE_DAYS;

        // Vérifier si Minus-20 est applicable et plus avantageux
        if (profile.shortestCycleLength !== undefined) {
            const minus20Day = applyMinus20Rule(profile.shortestCycleLength);
            if (minus20Day > FIVE_DAY_RULE_DAYS) {
                rule = 'minus-20';
                lastInfertileDay = minus20Day;
            }
        }
    }

    // Ajuster selon la glaire (double-check)
    lastInfertileDay = adjustForMucus(lastInfertileDay, entries);

    return {
        rule,
        lastInfertileDay,
        fertilityStartsDay: lastInfertileDay + 1,
    };
}

/**
 * Met à jour l'historique des premières températures hautes
 * 
 * @param profile - Profil utilisateur
 * @param firstHigherTempDay - Jour de la première temp haute du cycle actuel
 * @returns Profil mis à jour
 */
export function updateEarliestFirstHigherTemp(
    profile: UserProfile,
    firstHigherTempDay: number
): UserProfile {
    const temps = [...profile.earliestFirstHigherTemps, firstHigherTempDay];

    // Garder les 12 derniers
    while (temps.length > MIN_CYCLES_FOR_MINUS_8) {
        temps.shift();
    }

    return {
        ...profile,
        earliestFirstHigherTemps: temps,
        cycleCount: profile.cycleCount + 1,
    };
}

// ============================================================================
// RÉFÉRENCES AUX RÈGLES (pour traçabilité)
// ============================================================================

export const CYCLE_START_RULES: Record<string, RuleReference> = {
    FIVE_DAY: {
        ruleId: 'START_5DAY',
        ruleName: 'Règle des 5 jours (débutantes)',
        sourceLineStart: 3015,
        sourceLineEnd: 3017,
    },
    FIVE_DAY_TRANSITION: {
        ruleId: 'START_5DAY_TRANS',
        ruleName: 'Transition 5-day → Minus-8 si temp haute ≤ jour 12',
        sourceLineStart: 3018,
        sourceLineEnd: 3021,
    },
    MINUS_8: {
        ruleId: 'START_MINUS8',
        ruleName: 'Règle Minus-8',
        sourceLineStart: 2919,
        sourceLineEnd: 2923,
    },
    MINUS_8_REQUIREMENT: {
        ruleId: 'START_MINUS8_REQ',
        ruleName: 'Minus-8 requiert 12 cycles minimum',
        sourceLineStart: 2916,
        sourceLineEnd: 2918,
    },
    MINUS_20: {
        ruleId: 'START_MINUS20',
        ruleName: 'Règle Minus-20 (calendrier menstruel)',
        sourceLineStart: 3143,
        sourceLineEnd: 3144,
    },
    MUCUS_OVERRIDES: {
        ruleId: 'START_MUCUS',
        ruleName: 'La glaire prime (double-check)',
        sourceLineStart: 2921,
        sourceLineEnd: 2923,
    },
};

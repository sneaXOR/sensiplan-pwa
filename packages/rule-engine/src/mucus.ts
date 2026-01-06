/**
 * SensiPlan Rule Engine - Règles de Glaire Cervicale
 * 
 * Implémentation des règles d'évaluation de la glaire cervicale
 * pour la détection du pic (Peak Day) et du shift post-ovulatoire.
 * 
 * Source: doc.txt lignes 1595-1637, 1700-1730, 2800-2810
 */

import {
    DailyEntry,
    MucusCategory,
    MucusEvaluation,
    MUCUS_QUALITY_ORDER,
    RuleReference,
} from './types';

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Nombre de jours après le pic pour confirmer le shift
 * Source: doc.txt ligne 2800-2801 "On the third day following the cervical mucus peak"
 */
const POST_PEAK_DAYS_REQUIRED = 3;

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Compare la qualité de deux catégories de glaire
 * @returns -1 si a < b, 0 si égal, 1 si a > b
 */
export function compareMucusQuality(a: MucusCategory, b: MucusCategory): number {
    const orderA = MUCUS_QUALITY_ORDER[a];
    const orderB = MUCUS_QUALITY_ORDER[b];
    return orderA - orderB;
}

/**
 * Extrait les observations de glaire valides d'une liste d'entrées
 */
export function getMucusObservations(entries: DailyEntry[]): { day: number; mucus: MucusCategory }[] {
    return entries
        .filter(e => e.mucusObservation !== undefined)
        .map(e => ({ day: e.cycleDay, mucus: e.mucusObservation! }))
        .sort((a, b) => a.day - b.day);
}

/**
 * Trouve la qualité maximale de glaire dans une liste
 */
export function findHighestQuality(observations: { day: number; mucus: MucusCategory }[]): MucusCategory | null {
    if (observations.length === 0) return null;

    let highest: MucusCategory = observations[0].mucus;
    for (const obs of observations) {
        if (compareMucusQuality(obs.mucus, highest) > 0) {
            highest = obs.mucus;
        }
    }
    return highest;
}

// ============================================================================
// RÈGLE DU PIC DE GLAIRE
// Source: doc.txt lignes 1706-1717
// ============================================================================

/**
 * Identifie le jour du pic de glaire (Peak Day)
 * 
 * Règle: Le pic est le DERNIER jour de la meilleure qualité de glaire
 * AVANT qu'elle ne passe à une qualité inférieure.
 * 
 * Le pic ne peut être déterminé qu'après coup (rétrospectif).
 * 
 * @param entries - Entrées du cycle triées par jour
 * @returns Jour du pic ou null si pas encore identifiable
 */
export function findPeakDay(entries: DailyEntry[]): number | null {
    const observations = getMucusObservations(entries);

    if (observations.length < 2) {
        return null; // Besoin d'au moins 2 observations
    }

    // Trouver la qualité la plus haute observée
    const highestQuality = findHighestQuality(observations);
    if (highestQuality === null) return null;

    // Trouver le dernier jour avec cette qualité
    let lastDayWithHighest: number | null = null;
    let foundTransition = false;

    for (let i = 0; i < observations.length; i++) {
        const current = observations[i];

        if (current.mucus === highestQuality) {
            lastDayWithHighest = current.day;
        }

        // Vérifier s'il y a une transition vers qualité inférieure après
        if (lastDayWithHighest !== null && current.day > lastDayWithHighest) {
            if (compareMucusQuality(current.mucus, highestQuality) < 0) {
                foundTransition = true;
                break;
            }
        }
    }

    // Le pic n'est confirmé que si on a vu une transition vers qualité inférieure
    return foundTransition ? lastDayWithHighest : null;
}

// ============================================================================
// RÈGLE P+1+2+3
// Source: doc.txt ligne 2800-2801
// ============================================================================

/**
 * Évalue le shift de glaire cervicale selon les règles SensiPlan
 * 
 * Règle principale:
 * - Identifier le pic (P)
 * - Compter 3 jours après le pic (1-2-3)
 * - L'évaluation est complète le 3ème jour
 * 
 * Règle spéciale 1 (doc.txt lignes 2804-2806):
 * - Si retour à qualité P pendant P-1-2-3, recommencer
 * 
 * Règle spéciale 2 (doc.txt lignes 2833-2835):
 * - Si retour à qualité P avant fin shift temp, recommencer
 * (cette règle est gérée dans fertility-status.ts)
 * 
 * @param entries - Entrées du cycle triées par jour
 * @returns Évaluation complète du shift de glaire
 */
export function evaluateMucusShift(entries: DailyEntry[]): MucusEvaluation {
    const observations = getMucusObservations(entries);

    if (observations.length === 0) {
        return {
            isShiftComplete: false,
            postPeakCount: 0,
            peakQualityReturned: false,
        };
    }

    const peakDay = findPeakDay(entries);

    if (peakDay === null) {
        return {
            isShiftComplete: false,
            postPeakCount: 0,
            peakQualityReturned: false,
        };
    }

    // Trouver la qualité au pic
    const peakObs = observations.find(o => o.day === peakDay);
    if (!peakObs) {
        return {
            peakDay,
            isShiftComplete: false,
            postPeakCount: 0,
            peakQualityReturned: false,
        };
    }

    const peakQuality = peakObs.mucus;

    // Compter les jours après le pic avec qualité inférieure
    const postPeakObs = observations.filter(o => o.day > peakDay);
    let postPeakCount = 0;
    let peakQualityReturned = false;

    for (const obs of postPeakObs) {
        if (compareMucusQuality(obs.mucus, peakQuality) >= 0) {
            // Retour à qualité égale ou supérieure au pic
            // Règle spéciale 1: recommencer le comptage
            peakQualityReturned = true;
            break;
        }
        postPeakCount++;

        if (postPeakCount >= POST_PEAK_DAYS_REQUIRED) {
            break;
        }
    }

    return {
        peakDay,
        isShiftComplete: postPeakCount >= POST_PEAK_DAYS_REQUIRED && !peakQualityReturned,
        postPeakCount,
        peakQualityReturned,
    };
}

/**
 * Vérifie si la glaire indique le début de la période fertile
 * 
 * Source: doc.txt lignes 2903-2904
 * "the onset of fertility is indicated by the presence of any type of cervical mucus"
 * 
 * @param entry - Entrée du jour
 * @returns true si la glaire indique fertilité
 */
export function mucusIndicatesFertility(entry: DailyEntry): boolean {
    if (entry.mucusObservation === undefined) {
        return false;
    }

    // Toute glaire autre que 'd' (dry) indique fertilité potentielle
    // 'ø' signifie "rien ressenti" mais c'est différent de "sec"
    // 'm' = moist = humide = fertilité
    return entry.mucusObservation !== 'd';
}

// ============================================================================
// CAS SPÉCIAL: TRANSITION DANS LA MÊME CATÉGORIE
// Source: doc.txt lignes 1861-1930
// ============================================================================

/**
 * Vérifie s'il y a une transition vers qualité inférieure dans la même catégorie
 * 
 * Ce cas s'applique quand le pic arrive bien après le shift de température.
 * Dans ce cas, on peut bracketer les abréviations après une transition
 * même si elles sont dans la même catégorie (ex: S+ humide vers S+ sec).
 * 
 * Note: Cette fonctionnalité nécessite les descriptions détaillées de la glaire,
 * pas seulement la catégorie. À implémenter si nécessaire.
 */
export function checkSameCategoryTransition(
    entries: DailyEntry[],
    _peakDay: number
): boolean {
    // Pour l'instant, on ne gère que les catégories simples
    // Cette fonction pourrait être étendue pour analyser mucusSensation/mucusAppearance
    return false;
}

// ============================================================================
// RÉFÉRENCES AUX RÈGLES (pour traçabilité)
// ============================================================================

export const MUCUS_RULES: Record<string, RuleReference> = {
    CLASSIFICATION: {
        ruleId: 'MUCUS_CLASS',
        ruleName: 'Classification de la glaire (d < ø < m < S < S+)',
        sourceLineStart: 1595,
        sourceLineEnd: 1637,
    },
    PEAK_DAY: {
        ruleId: 'MUCUS_PEAK',
        ruleName: 'Jour du pic = dernier jour meilleure qualité avant déclin',
        sourceLineStart: 1706,
        sourceLineEnd: 1717,
    },
    POST_PEAK_COUNT: {
        ruleId: 'MUCUS_P123',
        ruleName: 'Évaluation P+1+2+3',
        sourceLineStart: 2800,
        sourceLineEnd: 2801,
    },
    PEAK_RETURN_RESTART: {
        ruleId: 'MUCUS_RESTART',
        ruleName: 'Retour qualité P → recommencer comptage',
        sourceLineStart: 2804,
        sourceLineEnd: 2806,
    },
    PEAK_BEFORE_TEMP_COMPLETE: {
        ruleId: 'MUCUS_BEFORE_TEMP',
        ruleName: 'Retour qualité P avant fin shift temp → recommencer',
        sourceLineStart: 2833,
        sourceLineEnd: 2835,
    },
};

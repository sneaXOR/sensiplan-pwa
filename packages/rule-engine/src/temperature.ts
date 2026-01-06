/**
 * SensiPlan Rule Engine - Règles de Température
 * 
 * Implémentation des règles d'évaluation de la température basale
 * pour la détection du shift thermique post-ovulatoire.
 * 
 * Source: doc.txt lignes 2735-2793
 */

import {
    DailyEntry,
    TemperatureEvaluation,
    RuleReference,
} from './types';

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Élévation minimale requise pour la 3ème température haute
 * Source: doc.txt ligne 2740 "at least 2 boxes (2/10°C)"
 */
const MIN_THIRD_TEMP_ELEVATION = 0.2; // 0.2°C = 2 dixièmes

/**
 * Nombre de températures basses pour établir la coverline
 * Source: doc.txt ligne 2738-2739 "higher than the six previous readings"
 */
const LOW_TEMP_COUNT = 6;

/**
 * Nombre de températures hautes requises
 * Source: doc.txt ligne 2737 "three consecutive readings"
 */
const HIGH_TEMP_COUNT = 3;

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Extrait les températures valides (non exclues) d'une liste d'entrées
 */
export function getValidTemperatures(entries: DailyEntry[]): { day: number; temp: number }[] {
    return entries
        .filter(e => e.temperature !== undefined && !e.temperatureExcluded)
        .map(e => ({ day: e.cycleDay, temp: e.temperature! }))
        .sort((a, b) => a.day - b.day);
}

/**
 * Trouve la température maximale dans une liste
 */
function maxTemp(temps: { day: number; temp: number }[]): number {
    if (temps.length === 0) return 0;
    return Math.max(...temps.map(t => t.temp));
}

// ============================================================================
// RÈGLE PRINCIPALE DE TEMPÉRATURE
// Source: doc.txt lignes 2736-2742
// ============================================================================

/**
 * Évalue le shift de température selon les règles SensiPlan
 * 
 * Règle principale:
 * - 3 températures consécutives au-dessus des 6 précédentes
 * - La 3ème doit être au moins 0.2°C au-dessus de la coverline
 * 
 * @param entries - Entrées du cycle triées par jour
 * @returns Évaluation complète du shift de température
 */
export function evaluateTemperatureShift(entries: DailyEntry[]): TemperatureEvaluation {
    const temps = getValidTemperatures(entries);

    // Pas assez de données
    if (temps.length < LOW_TEMP_COUNT + HIGH_TEMP_COUNT) {
        return {
            isShiftComplete: false,
            higherTempDays: [],
            exceptionUsed: 'none',
            cannotEvaluate: true,
            cannotEvaluateReason: 'Pas assez de mesures de température',
        };
    }

    // Parcourir les jours pour trouver un shift valide
    for (let i = LOW_TEMP_COUNT; i <= temps.length - HIGH_TEMP_COUNT; i++) {
        const lowTemps = temps.slice(i - LOW_TEMP_COUNT, i);
        const coverLine = maxTemp(lowTemps);

        // Vérifier les 3 températures suivantes
        const potentialHighTemps = temps.slice(i, i + HIGH_TEMP_COUNT);

        const result = checkTemperatureRule(coverLine, potentialHighTemps, temps, i);
        if (result.isShiftComplete) {
            return result;
        }

        // Essayer les exceptions si la règle principale échoue
        const exceptionResult = tryExceptions(coverLine, temps, i);
        if (exceptionResult.isShiftComplete) {
            return exceptionResult;
        }
    }

    return {
        isShiftComplete: false,
        higherTempDays: [],
        exceptionUsed: 'none',
        cannotEvaluate: false,
    };
}

/**
 * Vérifie la règle principale de température
 * Source: doc.txt lignes 2736-2742
 */
function checkTemperatureRule(
    coverLine: number,
    highTemps: { day: number; temp: number }[],
    _allTemps: { day: number; temp: number }[],
    _startIndex: number
): TemperatureEvaluation {
    // Toutes les 3 températures doivent être au-dessus de la coverline
    const allAboveCoverLine = highTemps.every(t => t.temp > coverLine);

    if (!allAboveCoverLine) {
        return {
            isShiftComplete: false,
            coverLineTemp: coverLine,
            higherTempDays: [],
            exceptionUsed: 'none',
            cannotEvaluate: false,
        };
    }

    // La 3ème doit être au moins 0.2°C au-dessus
    const thirdTemp = highTemps[2].temp;
    const isThirdHighEnough = thirdTemp >= coverLine + MIN_THIRD_TEMP_ELEVATION;

    if (isThirdHighEnough) {
        return {
            isShiftComplete: true,
            coverLineTemp: coverLine,
            higherTempDays: highTemps.map(t => t.day),
            exceptionUsed: 'none',
            cannotEvaluate: false,
        };
    }

    return {
        isShiftComplete: false,
        coverLineTemp: coverLine,
        higherTempDays: highTemps.map(t => t.day),
        exceptionUsed: 'none',
        cannotEvaluate: false,
    };
}

/**
 * Essaie les exceptions aux règles de température
 * 
 * Exception 1 (doc.txt lignes 2782-2785):
 * Si la 3ème température n'est pas 0.2°C au-dessus, une 4ème est requise
 * (doit être au-dessus de la coverline mais pas nécessairement 0.2°C)
 * 
 * Exception 2 (doc.txt lignes 2786-2790):
 * 1 des 3 températures peut tomber sur ou sous la coverline.
 * Cette valeur est ignorée, mais la 3ème doit être 0.2°C au-dessus.
 * 
 * IMPORTANT (doc.txt lignes 2791-2793):
 * Les deux exceptions NE PEUVENT PAS être utilisées ensemble.
 */
function tryExceptions(
    coverLine: number,
    allTemps: { day: number; temp: number }[],
    startIndex: number
): TemperatureEvaluation {
    // Besoin d'au moins 4 températures pour l'exception 1
    if (startIndex + 4 <= allTemps.length) {
        const result = tryFirstException(coverLine, allTemps, startIndex);
        if (result.isShiftComplete) {
            return result;
        }
    }

    // Exception 2 nécessite 3 températures
    if (startIndex + 3 <= allTemps.length) {
        const result = trySecondException(coverLine, allTemps, startIndex);
        if (result.isShiftComplete) {
            return result;
        }
    }

    return {
        isShiftComplete: false,
        coverLineTemp: coverLine,
        higherTempDays: [],
        exceptionUsed: 'none',
        cannotEvaluate: false,
    };
}

/**
 * Exception 1: 4ème température requise
 * Source: doc.txt lignes 2782-2785
 */
function tryFirstException(
    coverLine: number,
    allTemps: { day: number; temp: number }[],
    startIndex: number
): TemperatureEvaluation {
    const temps = allTemps.slice(startIndex, startIndex + 4);

    // Vérifier que les 3 premières sont au-dessus de la coverline
    const firstThree = temps.slice(0, 3);
    const allAbove = firstThree.every(t => t.temp > coverLine);

    if (!allAbove) {
        return {
            isShiftComplete: false,
            coverLineTemp: coverLine,
            higherTempDays: [],
            exceptionUsed: 'none',
            cannotEvaluate: false,
        };
    }

    // La 3ème n'est pas assez haute (sinon règle principale aurait marché)
    const thirdTemp = temps[2].temp;
    if (thirdTemp >= coverLine + MIN_THIRD_TEMP_ELEVATION) {
        // La règle principale aurait dû fonctionner
        return {
            isShiftComplete: false,
            coverLineTemp: coverLine,
            higherTempDays: [],
            exceptionUsed: 'none',
            cannotEvaluate: false,
        };
    }

    // Vérifier la 4ème - doit juste être au-dessus de la coverline
    const fourthTemp = temps[3].temp;
    if (fourthTemp > coverLine) {
        return {
            isShiftComplete: true,
            coverLineTemp: coverLine,
            higherTempDays: temps.map(t => t.day),
            exceptionUsed: 'first',
            cannotEvaluate: false,
        };
    }

    return {
        isShiftComplete: false,
        coverLineTemp: coverLine,
        higherTempDays: [],
        exceptionUsed: 'none',
        cannotEvaluate: false,
    };
}

/**
 * Exception 2: 1 température peut tomber sur/sous la coverline
 * Source: doc.txt lignes 2786-2790
 */
function trySecondException(
    coverLine: number,
    allTemps: { day: number; temp: number }[],
    startIndex: number
): TemperatureEvaluation {
    const temps = allTemps.slice(startIndex, startIndex + 3);

    // Compter combien sont sous ou égales à la coverline
    const belowOrEqual = temps.filter(t => t.temp <= coverLine);

    // Exactement 1 doit être sur ou sous la coverline
    if (belowOrEqual.length !== 1) {
        return {
            isShiftComplete: false,
            coverLineTemp: coverLine,
            higherTempDays: [],
            exceptionUsed: 'none',
            cannotEvaluate: false,
        };
    }

    // Les 2 autres doivent être au-dessus
    const aboveCoverLine = temps.filter(t => t.temp > coverLine);
    if (aboveCoverLine.length !== 2) {
        return {
            isShiftComplete: false,
            coverLineTemp: coverLine,
            higherTempDays: [],
            exceptionUsed: 'none',
            cannotEvaluate: false,
        };
    }

    // La 3ème (index 2) doit être 0.2°C au-dessus
    const thirdTemp = temps[2].temp;
    if (thirdTemp >= coverLine + MIN_THIRD_TEMP_ELEVATION) {
        // Ne pas compter la température sur/sous la coverline
        const validDays = temps
            .filter(t => t.temp > coverLine)
            .map(t => t.day);

        // Mais on a besoin des jours pour le triangle
        return {
            isShiftComplete: true,
            coverLineTemp: coverLine,
            higherTempDays: validDays,
            exceptionUsed: 'second',
            cannotEvaluate: false,
        };
    }

    return {
        isShiftComplete: false,
        coverLineTemp: coverLine,
        higherTempDays: [],
        exceptionUsed: 'none',
        cannotEvaluate: false,
    };
}

// ============================================================================
// RÉFÉRENCES AUX RÈGLES (pour traçabilité)
// ============================================================================

export const TEMPERATURE_RULES: Record<string, RuleReference> = {
    MAIN_RULE: {
        ruleId: 'TEMP_MAIN',
        ruleName: 'Règle principale de température',
        sourceLineStart: 2736,
        sourceLineEnd: 2742,
    },
    EXCEPTION_1: {
        ruleId: 'TEMP_EX1',
        ruleName: 'Exception 1 - 4ème température requise',
        sourceLineStart: 2782,
        sourceLineEnd: 2785,
    },
    EXCEPTION_2: {
        ruleId: 'TEMP_EX2',
        ruleName: 'Exception 2 - 1 température peut tomber sur/sous coverline',
        sourceLineStart: 2786,
        sourceLineEnd: 2790,
    },
    NO_COMBINED_EXCEPTIONS: {
        ruleId: 'TEMP_NO_COMBINE',
        ruleName: 'Les deux exceptions ne peuvent pas être utilisées ensemble',
        sourceLineStart: 2791,
        sourceLineEnd: 2793,
    },
};

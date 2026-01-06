/**
 * SensiPlan Rule Engine - Statut de Fertilité
 * 
 * Calcul du statut de fertilité final en utilisant le principe
 * du double-check (température + glaire/col).
 * 
 * Source: doc.txt lignes 2840-2896
 */

import {
    DailyEntry,
    Cycle,
    UserProfile,
    FertilityStatus,
    FertilityStatusType,
    CyclePhase,
    RuleReference,
    DataPoint,
} from './types';
import { evaluateTemperatureShift, TEMPERATURE_RULES } from './temperature';
import { evaluateMucusShift, MUCUS_RULES, getMucusObservations, findHighestQuality, compareMucusQuality } from './mucus';
import { determineCycleStart, CYCLE_START_RULES } from './cycle-start';

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Nombre de jours maximum sans élévation de température avant alerte
 * Basé sur doc.txt lignes 1306-1310 "more than three months = amenorrhea"
 */
const LONG_CYCLE_WARNING_DAYS = 60;
const AMENORRHEA_WARNING_DAYS = 90;

// ============================================================================
// MESSAGES EXPLICATIFS
// ============================================================================

const MESSAGES = {
    PRE_OVULATION_INFERTILE: {
        fr: 'Période infertile en début de cycle',
        en: 'Infertile period at the beginning of the cycle',
    },
    FERTILE_MUCUS_STARTED: {
        fr: 'Glaire cervicale observée - période fertile',
        en: 'Cervical mucus observed - fertile period',
    },
    FERTILE_WAITING_DOUBLE_CHECK: {
        fr: 'En attente de confirmation double-check',
        en: 'Waiting for double-check confirmation',
    },
    POST_OVULATION_INFERTILE: {
        fr: 'Période infertile après ovulation confirmée',
        en: 'Infertile period after confirmed ovulation',
    },
    INDETERMINATE_MISSING_DATA: {
        fr: 'Données insuffisantes pour évaluation',
        en: 'Insufficient data for evaluation',
    },
    INDETERMINATE_EXCEPTIONS_CONFLICT: {
        fr: 'Évaluation impossible - continuer les observations',
        en: 'Evaluation not possible - continue observations',
    },
};

const WARNINGS = {
    LONG_CYCLE: {
        fr: 'Cycle très long détecté (>60 jours)',
        en: 'Very long cycle detected (>60 days)',
    },
    AMENORRHEA: {
        fr: 'Pas de règles depuis plus de 90 jours - consultation recommandée',
        en: 'No period for more than 90 days - consultation recommended',
    },
    PEAK_RETURNED: {
        fr: 'Retour à qualité de glaire élevée - comptage recommencé',
        en: 'Return to high mucus quality - count restarted',
    },
    NO_TEMP_SHIFT: {
        fr: 'Pas de décalage de température confirmé',
        en: 'No confirmed temperature shift',
    },
};

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Calcule le statut de fertilité pour un jour donné
 * 
 * Principe du double-check (doc.txt ligne 2843-2846):
 * "The infertile time after ovulation begins on the evening of the 3rd day
 *  after the cervical mucus shift OR the evening of the 3rd higher temperature
 *  measurement, WHICHEVER COMES LAST"
 * 
 * @param entries - Toutes les entrées du cycle
 * @param currentDay - Jour du cycle à évaluer
 * @param cycle - Données du cycle
 * @param profile - Profil utilisateur
 * @returns Statut de fertilité complet avec explications
 */
export function calculateFertilityStatus(
    entries: DailyEntry[],
    currentDay: number,
    cycle: Cycle,
    profile: UserProfile
): FertilityStatus {
    const dataPointsUsed: DataPoint[] = [];
    const rulesApplied: RuleReference[] = [];
    const warnings: { fr: string; en: string }[] = [];

    // Vérifier les alertes de cycle long
    if (currentDay > AMENORRHEA_WARNING_DAYS) {
        warnings.push(WARNINGS.AMENORRHEA);
    } else if (currentDay > LONG_CYCLE_WARNING_DAYS) {
        warnings.push(WARNINGS.LONG_CYCLE);
    }

    // 1. Déterminer le début de la période fertile
    const cycleStart = determineCycleStart(profile, entries);
    rulesApplied.push(CYCLE_START_RULES[
        cycleStart.rule === 'five-day' ? 'FIVE_DAY' :
            cycleStart.rule === 'minus-8' ? 'MINUS_8' : 'MINUS_20'
    ]);

    // 2. Si on est avant le début de fertilité
    if (currentDay <= cycleStart.lastInfertileDay) {
        // Vérifier si glaire observée aujourd'hui
        const todayEntry = entries.find(e => e.cycleDay === currentDay);
        if (todayEntry?.mucusObservation && todayEntry.mucusObservation !== 'd') {
            // Glaire observée - fertilité commence
            return createFertileStatus(
                'pre-ovulation',
                MESSAGES.FERTILE_MUCUS_STARTED,
                rulesApplied,
                dataPointsUsed,
                warnings
            );
        }

        return createInfertileStatus(
            'pre-ovulation',
            MESSAGES.PRE_OVULATION_INFERTILE,
            rulesApplied,
            dataPointsUsed,
            warnings
        );
    }

    // 3. Évaluer le shift de température
    const tempEval = evaluateTemperatureShift(entries);
    if (tempEval.coverLineTemp !== undefined) {
        dataPointsUsed.push({
            date: '',
            cycleDay: 0,
            field: 'coverLine',
            value: tempEval.coverLineTemp,
        });
    }

    if (tempEval.exceptionUsed !== 'none') {
        rulesApplied.push(TEMPERATURE_RULES[
            tempEval.exceptionUsed === 'first' ? 'EXCEPTION_1' : 'EXCEPTION_2'
        ]);
    } else if (tempEval.isShiftComplete) {
        rulesApplied.push(TEMPERATURE_RULES.MAIN_RULE);
    }

    // 4. Évaluer le shift de glaire
    const mucusEval = evaluateMucusShift(entries);
    if (mucusEval.peakDay !== undefined) {
        rulesApplied.push(MUCUS_RULES.PEAK_DAY);
        dataPointsUsed.push({
            date: '',
            cycleDay: mucusEval.peakDay,
            field: 'peakDay',
            value: mucusEval.peakDay,
        });
    }

    if (mucusEval.peakQualityReturned) {
        warnings.push(WARNINGS.PEAK_RETURNED);
        rulesApplied.push(MUCUS_RULES.PEAK_RETURN_RESTART);
    }

    // 5. Double-check: les deux doivent être complets
    if (!tempEval.isShiftComplete || !mucusEval.isShiftComplete) {
        // Au moins un n'est pas complet → fertile

        if (!tempEval.isShiftComplete) {
            warnings.push(WARNINGS.NO_TEMP_SHIFT);
        }

        // Vérifier si retour de qualité P avant fin temp shift
        if (mucusEval.peakQualityReturned && !tempEval.isShiftComplete) {
            rulesApplied.push(MUCUS_RULES.PEAK_BEFORE_TEMP_COMPLETE);
        }

        return createFertileStatus(
            'fertile',
            MESSAGES.FERTILE_WAITING_DOUBLE_CHECK,
            rulesApplied,
            dataPointsUsed,
            warnings
        );
    }

    // 6. Double-check complet - déterminer le jour de fin de fertilité
    // "whichever comes last"
    rulesApplied.push({
        ruleId: 'DOUBLE_CHECK',
        ruleName: 'Double-check température + glaire',
        sourceLineStart: 2843,
        sourceLineEnd: 2846,
    });

    const tempShiftCompleteDay = tempEval.higherTempDays.length >= 3
        ? tempEval.higherTempDays[2]
        : (tempEval.higherTempDays.length >= 4 ? tempEval.higherTempDays[3] : 999);

    const mucusShiftCompleteDay = mucusEval.peakDay !== undefined
        ? mucusEval.peakDay + 3
        : 999;

    const fertilityEndsDay = Math.max(tempShiftCompleteDay, mucusShiftCompleteDay);

    dataPointsUsed.push({
        date: '',
        cycleDay: fertilityEndsDay,
        field: 'fertilityEndsDay',
        value: fertilityEndsDay,
    });

    // 7. Si on est au jour de fin ou après → infertile (le soir)
    if (currentDay >= fertilityEndsDay) {
        return createInfertileStatus(
            'post-ovulation',
            MESSAGES.POST_OVULATION_INFERTILE,
            rulesApplied,
            dataPointsUsed,
            warnings
        );
    }

    // Sinon on est encore dans la période fertile
    return createFertileStatus(
        'fertile',
        MESSAGES.FERTILE_WAITING_DOUBLE_CHECK,
        rulesApplied,
        dataPointsUsed,
        warnings
    );
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

function createInfertileStatus(
    phase: CyclePhase,
    message: { fr: string; en: string },
    rulesApplied: RuleReference[],
    dataPointsUsed: DataPoint[],
    warnings: { fr: string; en: string }[]
): FertilityStatus {
    return {
        status: 'infertile',
        phase,
        rulesApplied,
        dataPointsUsed,
        explanation: message,
        warnings,
    };
}

function createFertileStatus(
    phase: CyclePhase,
    message: { fr: string; en: string },
    rulesApplied: RuleReference[],
    dataPointsUsed: DataPoint[],
    warnings: { fr: string; en: string }[]
): FertilityStatus {
    return {
        status: 'fertile',
        phase,
        rulesApplied,
        dataPointsUsed,
        explanation: message,
        warnings,
    };
}

function createIndeterminateStatus(
    message: { fr: string; en: string },
    rulesApplied: RuleReference[],
    dataPointsUsed: DataPoint[],
    warnings: { fr: string; en: string }[]
): FertilityStatus {
    return {
        status: 'indeterminate',
        phase: 'fertile', // Par défaut considéré fertile en cas de doute
        rulesApplied,
        dataPointsUsed,
        explanation: message,
        warnings,
    };
}

// ============================================================================
// RÉFÉRENCES AUX RÈGLES
// ============================================================================

export const FERTILITY_STATUS_RULES: Record<string, RuleReference> = {
    DOUBLE_CHECK: {
        ruleId: 'FERT_DOUBLE_CHECK',
        ruleName: 'Double-check: le plus tardif entre temp et glaire',
        sourceLineStart: 2843,
        sourceLineEnd: 2846,
    },
    INFERTILE_EVENING: {
        ruleId: 'FERT_EVENING',
        ruleName: 'Infertilité commence le soir',
        sourceLineStart: 2843,
        sourceLineEnd: 2846,
    },
    IGNORE_MUCUS_AFTER: {
        ruleId: 'FERT_IGNORE_MUCUS',
        ruleName: 'Ignorer la glaire après double-check complet',
        sourceLineStart: 2875,
        sourceLineEnd: 2876,
    },
};

/**
 * SensiPlan Rule Engine
 * 
 * Moteur de règles déterministe pour le calcul du statut de fertilité
 * selon la méthode sympto-thermique SensiPlan.
 * 
 * Basé exclusivement sur: "Natural & Safe: The Handbook" (doc.txt)
 */

// Types
export * from './types';

// Règles de température
export {
    evaluateTemperatureShift,
    getValidTemperatures,
    TEMPERATURE_RULES,
} from './temperature';

// Règles de glaire
export {
    evaluateMucusShift,
    findPeakDay,
    compareMucusQuality,
    getMucusObservations,
    findHighestQuality,
    mucusIndicatesFertility,
    MUCUS_RULES,
} from './mucus';

// Règles de début de cycle
export {
    applyFiveDayRule,
    applyMinus8Rule,
    applyMinus20Rule,
    canUseFiveDayRule,
    determineCycleStart,
    updateEarliestFirstHigherTemp,
    adjustForMucus,
    CYCLE_START_RULES,
} from './cycle-start';

// Statut de fertilité
export {
    calculateFertilityStatus,
    FERTILITY_STATUS_RULES,
} from './fertility-status';

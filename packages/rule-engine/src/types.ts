/**
 * SensiPlan Rule Engine - Types
 * 
 * Définitions TypeScript pour le suivi de fertilité SensiPlan.
 * Basé exclusivement sur le document "Natural & Safe: The Handbook"
 * 
 * @see doc.txt lignes référencées dans les commentaires
 */

// ============================================================================
// CATÉGORIES DE GLAIRE CERVICALE
// Source: doc.txt lignes 1595-1637
// ============================================================================

/**
 * Classification de la glaire cervicale selon SensiPlan
 * Ordre de qualité croissante: d < ø < m < S < S+
 */
export type MucusCategory = 'd' | 'ø' | 'm' | 'S' | 'S+';

/**
 * Ordre numérique des catégories de glaire pour comparaison
 */
export const MUCUS_QUALITY_ORDER: Record<MucusCategory, number> = {
    'd': 0,   // dry, rough, itching - aucune glaire visible
    'ø': 1,   // nothing felt, no moistness - aucune glaire visible
    'm': 2,   // moist but no visible mucus
    'S': 3,   // moist + thick/whitish/opaque/creamy/lumpy
    'S+': 4,  // wet/slippery AND/OR translucent/stretchy/egg-white
};

// ============================================================================
// ENTRÉE QUOTIDIENNE
// ============================================================================

/**
 * Méthode de prise de température
 * Source: doc.txt lignes 1967-1976
 */
export type TemperatureMethod = 'oral' | 'rectal' | 'vaginal';

/**
 * Intensité des saignements
 * Source: doc.txt lignes 1400-1401
 */
export type BleedingIntensity = 0 | 1 | 2 | 3;
// 0 = aucun, 1 = spotting, 2 = normal, 3 = abondant

/**
 * Position du col
 * Source: doc.txt lignes 2494-2496
 */
export type CervixPosition = 'low' | 'medium' | 'high';

/**
 * Ouverture du col
 * Source: doc.txt lignes 2489-2493
 */
export type CervixOpening = 'closed' | 'partial' | 'open';

/**
 * Fermeté du col
 * Source: doc.txt lignes 2497-2499
 */
export type CervixFirmness = 'hard' | 'soft';

/**
 * Données d'une journée de suivi
 */
export interface DailyEntry {
    id: string;
    date: string;                    // Format ISO: YYYY-MM-DD
    cycleId: string;
    cycleDay: number;                // 1-indexed

    // Température (optionnelle car peut être manquante)
    temperature?: number;            // En °C, 2 décimales
    temperatureTime?: string;        // HH:MM
    temperatureMethod: TemperatureMethod;
    temperatureDisturbance?: string; // Raison de perturbation
    temperatureExcluded: boolean;    // True = entre parenthèses

    // Glaire cervicale
    mucusObservation?: MucusCategory;
    mucusSensation?: string;
    mucusAppearance?: string;

    // Saignements
    bleedingIntensity?: BleedingIntensity;

    // Col (optionnel - alternative à la glaire)
    cervixPosition?: CervixPosition;
    cervixOpening?: CervixOpening;
    cervixFirmness?: CervixFirmness;

    // Symptômes secondaires (informatifs uniquement - doc.txt lignes 2547-2551)
    mittelschmerz?: boolean;
    breastSymptoms?: boolean;

    // Notes libres
    notes?: string;

    // Métadonnées
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// CYCLE
// ============================================================================

/**
 * Règle appliquée pour déterminer le début de la période fertile
 * Source: doc.txt lignes 2908-3144
 */
export type CycleStartRule = 'five-day' | 'minus-8' | 'minus-20';

/**
 * Données d'un cycle menstruel
 */
export interface Cycle {
    id: string;
    startDate: string;               // Date du jour 1
    endDate?: string;                // Null si cycle en cours

    // Marqueurs calculés
    peakDay?: number;                // Jour du cycle où le pic de glaire a été identifié
    firstHigherTempDay?: number;     // Premier jour de température haute

    // État des évaluations
    temperatureShiftComplete: boolean;
    mucusShiftComplete: boolean;

    // Règle de début de cycle utilisée
    ruleApplied: CycleStartRule;
    lastInfertileDay?: number;       // Dernier jour infertile en début de cycle

    // Métadonnées
    isFirst12Cycles: boolean;        // Mode formation
    cycleNumber: number;             // Numéro séquentiel dans l'app
}

// ============================================================================
// PROFIL UTILISATEUR
// ============================================================================

export type Language = 'fr' | 'en';

export interface UserProfile {
    language: Language;
    temperatureMethod: TemperatureMethod;
    useCervixSign: boolean;          // Si true, utilise col au lieu de glaire

    // Historique pour calcul Minus-8
    // Source: doc.txt lignes 2916-2918
    earliestFirstHigherTemps: number[]; // Jours des premières temp hautes (max 12)

    // Pour Minus-20
    // Source: doc.txt ligne 3143-3144
    shortestCycleLength?: number;

    // Métadonnées
    createdAt: string;
    cycleCount: number;
}

// ============================================================================
// ÉVALUATIONS
// ============================================================================

/**
 * Résultat de l'évaluation de la température
 * Source: doc.txt lignes 2735-2793
 */
export interface TemperatureEvaluation {
    isShiftComplete: boolean;
    coverLineTemp?: number;          // Température de la ligne de couverture
    higherTempDays: number[];        // Jours du cycle avec temp haute (3 ou 4)
    exceptionUsed: 'none' | 'first' | 'second';

    // Si évaluation impossible
    cannotEvaluate: boolean;
    cannotEvaluateReason?: string;
}

/**
 * Résultat de l'évaluation de la glaire
 * Source: doc.txt lignes 1700-1730, 2800-2810
 */
export interface MucusEvaluation {
    peakDay?: number;                // Jour du pic (P)
    isShiftComplete: boolean;        // P+3 atteint avec qualité inférieure
    postPeakCount: number;           // Nombre de jours après P (0-3)

    // Si retour à qualité P
    peakQualityReturned: boolean;
}

/**
 * Résultat de l'évaluation du col
 * Source: doc.txt lignes 3159-3165
 */
export interface CervixEvaluation {
    isShiftComplete: boolean;        // 3 jours fermé et dur
    closedHardDays: number;          // Compteur de jours fermé/dur
}

/**
 * Statut de fertilité
 */
export type FertilityStatusType = 'fertile' | 'infertile' | 'indeterminate';

/**
 * Phase du cycle
 */
export type CyclePhase = 'pre-ovulation' | 'fertile' | 'post-ovulation';

/**
 * Référence à une règle appliquée (pour traçabilité)
 */
export interface RuleReference {
    ruleId: string;
    ruleName: string;
    sourceLineStart: number;         // Ligne dans doc.txt
    sourceLineEnd: number;
}

/**
 * Point de données utilisé dans le calcul
 */
export interface DataPoint {
    date: string;
    cycleDay: number;
    field: string;
    value: string | number | boolean;
}

/**
 * Statut de fertilité complet avec explication
 */
export interface FertilityStatus {
    status: FertilityStatusType;
    phase: CyclePhase;

    // Traçabilité (audit trail)
    rulesApplied: RuleReference[];
    dataPointsUsed: DataPoint[];

    // Explication en langage naturel
    explanation: {
        fr: string;
        en: string;
    };

    // Avertissements
    warnings: {
        fr: string;
        en: string;
    }[];
}

// ============================================================================
// EXPORT/IMPORT
// ============================================================================

export interface ExportData {
    version: '1.0';
    exportDate: string;
    profile: UserProfile;
    cycles: Cycle[];
    entries: DailyEntry[];
}

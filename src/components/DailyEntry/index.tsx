/**
 * Composant DailyEntry - Saisie quotidienne des données de fertilité
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './DailyEntry.css';
import {
    db,
    getCurrentCycle,
    createCycle,
    getEntryByDate,
    saveEntry,
    calculateCycleDay,
    getEntriesByCycle,
} from '../../storage/db';
import {
    calculateFertilityStatus,
    type DailyEntry as DailyEntryType,
    type Cycle,
    type UserProfile,
    type MucusCategory,
    type BleedingIntensity,
    type FertilityStatus,
} from '@sensiplan/rule-engine';

const MUCUS_OPTIONS: MucusCategory[] = ['d', 'ø', 'm', 'S', 'S+'];
const BLEEDING_OPTIONS: BleedingIntensity[] = [0, 1, 2, 3];

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function formatTimeForInput(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(Math.floor(date.getMinutes() / 5) * 5).padStart(2, '0');
    return `${hours}:${minutes}`;
}

export default function DailyEntry() {
    const { t, i18n } = useTranslation();
    const today = formatDate(new Date());

    const [selectedDate, setSelectedDate] = useState(today);
    const [cycle, setCycle] = useState<Cycle | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [cycleEntries, setCycleEntries] = useState<DailyEntryType[]>([]);
    const [fertilityStatus, setFertilityStatus] = useState<FertilityStatus | null>(null);

    // Form state
    const [temperature, setTemperature] = useState<string>('');
    const [temperatureTime, setTemperatureTime] = useState<string>(formatTimeForInput(new Date()));
    const [temperatureDisturbance, setTemperatureDisturbance] = useState<string>('');
    const [temperatureExcluded, setTemperatureExcluded] = useState(false);
    const [mucusObservation, setMucusObservation] = useState<MucusCategory | undefined>(undefined);
    const [bleedingIntensity, setBleedingIntensity] = useState<BleedingIntensity>(0);
    const [mittelschmerz, setMittelschmerz] = useState(false);
    const [breastSymptoms, setBreastSymptoms] = useState(false);
    const [notes, setNotes] = useState('');

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showNewCycleModal, setShowNewCycleModal] = useState(false);
    const [showWhyModal, setShowWhyModal] = useState(false);

    // Charger les données
    const loadData = useCallback(async () => {
        try {
            const currentCycle = await getCurrentCycle();
            setCycle(currentCycle || null);

            const p = await db.profile.get('default');
            setProfile(p || null);

            if (currentCycle) {
                const entries = await getEntriesByCycle(currentCycle.id);
                setCycleEntries(entries);

                // Charger l'entrée du jour sélectionné
                const entry = await getEntryByDate(selectedDate);
                if (entry) {
                    setTemperature(entry.temperature?.toFixed(2) || '');
                    setTemperatureTime(entry.temperatureTime || formatTimeForInput(new Date()));
                    setTemperatureDisturbance(entry.temperatureDisturbance || '');
                    setTemperatureExcluded(entry.temperatureExcluded || false);
                    setMucusObservation(entry.mucusObservation);
                    setBleedingIntensity(entry.bleedingIntensity || 0);
                    setMittelschmerz(entry.mittelschmerz || false);
                    setBreastSymptoms(entry.breastSymptoms || false);
                    setNotes(entry.notes || '');
                } else {
                    // Reset form for new entry
                    setTemperature('');
                    setMucusObservation(undefined);
                    setBleedingIntensity(0);
                    setMittelschmerz(false);
                    setBreastSymptoms(false);
                    setNotes('');
                }

                // Calculer le statut de fertilité
                if (p) {
                    const cycleDay = calculateCycleDay(currentCycle.startDate, selectedDate);
                    const status = calculateFertilityStatus(entries, cycleDay, currentCycle, p);
                    setFertilityStatus(status);
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }, [selectedDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Calculer le jour du cycle
    const cycleDay = cycle ? calculateCycleDay(cycle.startDate, selectedDate) : 0;

    // Sauvegarder l'entrée
    const handleSave = async () => {
        if (!cycle || !profile) return;

        setSaving(true);
        setSaved(false);

        try {
            const existingEntry = await getEntryByDate(selectedDate);

            const entry: DailyEntryType = {
                id: existingEntry?.id || crypto.randomUUID(),
                date: selectedDate,
                cycleId: cycle.id,
                cycleDay,
                temperature: temperature ? parseFloat(temperature) : undefined,
                temperatureTime,
                temperatureMethod: profile.temperatureMethod,
                temperatureDisturbance: temperatureDisturbance || undefined,
                temperatureExcluded,
                mucusObservation,
                bleedingIntensity: bleedingIntensity || undefined,
                mittelschmerz: mittelschmerz || undefined,
                breastSymptoms: breastSymptoms || undefined,
                notes: notes || undefined,
                createdAt: existingEntry?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await saveEntry(entry);
            setSaved(true);

            // Recharger pour mettre à jour le statut
            await loadData();

            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error('Error saving entry:', error);
        } finally {
            setSaving(false);
        }
    };

    // Créer un nouveau cycle
    const handleNewCycle = async () => {
        try {
            const newCycle = await createCycle(selectedDate);
            setCycle(newCycle);
            setShowNewCycleModal(false);
            await loadData();
        } catch (error) {
            console.error('Error creating cycle:', error);
        }
    };

    return (
        <div className="daily-entry">
            {/* Date selector and cycle day */}
            <div className="entry-header">
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="date-picker"
                />
                {cycle && (
                    <span className="cycle-day">
                        {t('entry.cycleDay', { day: cycleDay })}
                    </span>
                )}
            </div>

            {/* Fertility Status */}
            {fertilityStatus && (
                <div className={`status-card status-${fertilityStatus.status}`}>
                    <div className="status-main">
                        <span className={`status-badge status-${fertilityStatus.status}`}>
                            {fertilityStatus.status === 'fertile' && '●'}
                            {fertilityStatus.status === 'infertile' && '○'}
                            {fertilityStatus.status === 'indeterminate' && '◐'}
                            {t(`status.${fertilityStatus.status}`)}
                        </span>
                        <button
                            className="why-btn"
                            onClick={() => setShowWhyModal(true)}
                            aria-label={t('why.title')}
                        >
                            ?
                        </button>
                    </div>
                    <p className="status-explanation">
                        {fertilityStatus.explanation[i18n.language as 'fr' | 'en']}
                    </p>
                </div>
            )}

            {/* New Cycle Button (if no cycle) */}
            {!cycle && (
                <button
                    className="btn btn-primary btn-large new-cycle-btn"
                    onClick={() => setShowNewCycleModal(true)}
                >
                    {t('cycle.new')}
                </button>
            )}

            {/* Entry Form */}
            {cycle && (
                <form className="entry-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    {/* Temperature */}
                    <div className="form-section">
                        <label>{t('entry.temperature')}</label>
                        <p className="help-text">{t('entry.temperatureHelp')}</p>
                        <div className="temp-row">
                            <input
                                type="number"
                                step="0.01"
                                min="35"
                                max="40"
                                placeholder={t('entry.temperaturePlaceholder')}
                                value={temperature}
                                onChange={(e) => setTemperature(e.target.value)}
                                className="temp-input"
                            />
                            <span className="temp-unit">°C</span>
                            <input
                                type="time"
                                value={temperatureTime}
                                onChange={(e) => setTemperatureTime(e.target.value)}
                                step="300"
                                className="time-input"
                            />
                        </div>

                        <div className="disturbance-row">
                            <input
                                type="text"
                                placeholder={t('entry.disturbanceHint')}
                                value={temperatureDisturbance}
                                onChange={(e) => setTemperatureDisturbance(e.target.value)}
                                className="disturbance-input"
                            />
                        </div>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={temperatureExcluded}
                                onChange={(e) => setTemperatureExcluded(e.target.checked)}
                            />
                            {t('entry.excluded')}
                        </label>
                        <p className="help-text help-tip">{t('entry.excludedHelp')}</p>
                    </div>

                    {/* Cervical Mucus */}
                    <div className="form-section">
                        <label>{t('entry.mucus')}</label>
                        <p className="help-text">{t('entry.mucusHelp')}</p>
                        <div className="mucus-options">
                            {MUCUS_OPTIONS.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={`mucus-btn mucus-${option.replace('+', 'plus')} ${mucusObservation === option ? 'selected' : ''}`}
                                    onClick={() => setMucusObservation(mucusObservation === option ? undefined : option)}
                                    title={t(`entry.mucusDescriptions.${option}`)}
                                >
                                    <span className="mucus-label">{option}</span>
                                    <span className="mucus-name">{t(`entry.mucusCategories.${option}`)}</span>
                                </button>
                            ))}
                        </div>
                        {mucusObservation && (
                            <p className="selection-description">
                                {t(`entry.mucusDescriptions.${mucusObservation}`)}
                            </p>
                        )}
                    </div>

                    {/* Bleeding */}
                    <div className="form-section">
                        <label>{t('entry.bleeding')}</label>
                        <p className="help-text">{t('entry.bleedingHelp')}</p>
                        <div className="bleeding-options">
                            {BLEEDING_OPTIONS.map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    className={`bleeding-btn bleeding-${level} ${bleedingIntensity === level ? 'selected' : ''}`}
                                    onClick={() => setBleedingIntensity(level)}
                                    title={t(`entry.bleedingDescriptions.${['none', 'spotting', 'normal', 'heavy'][level]}`)}
                                >
                                    {t(`entry.bleedingLevels.${['none', 'spotting', 'normal', 'heavy'][level]}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Secondary Symptoms */}
                    <div className="form-section">
                        <label>{t('entry.symptoms')}</label>
                        <p className="help-text help-info">{t('entry.symptomsHelp')}</p>
                        <div className="symptoms-row">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={mittelschmerz}
                                    onChange={(e) => setMittelschmerz(e.target.checked)}
                                />
                                {t('entry.mittelschmerz')}
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={breastSymptoms}
                                    onChange={(e) => setBreastSymptoms(e.target.checked)}
                                />
                                {t('entry.breastSymptoms')}
                            </label>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="form-section">
                        <label>{t('entry.notes')}</label>
                        <textarea
                            placeholder={t('entry.notesPlaceholder')}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Save Button */}
                    <button
                        type="submit"
                        className="btn btn-primary btn-large save-btn"
                        disabled={saving}
                    >
                        {saved ? t('entry.saved') : saving ? '...' : t('entry.save')}
                    </button>
                </form>
            )}

            {/* New Cycle Modal */}
            {showNewCycleModal && (
                <div className="modal-overlay" onClick={() => setShowNewCycleModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>{t('cycle.new')}</h2>
                        <p>{t('cycle.newHint')}</p>
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowNewCycleModal(false)}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleNewCycle}
                            >
                                {t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Why Modal */}
            {showWhyModal && fertilityStatus && (
                <div className="modal-overlay" onClick={() => setShowWhyModal(false)}>
                    <div className="modal why-modal" onClick={(e) => e.stopPropagation()}>
                        <h2>{t('why.title')}</h2>

                        <div className="why-section">
                            <h3>{t('why.rulesApplied')}</h3>
                            <ul>
                                {fertilityStatus.rulesApplied.map((rule, i) => (
                                    <li key={i}>
                                        {rule.ruleName}
                                        <small className="rule-source">
                                            (doc.txt:{rule.sourceLineStart}-{rule.sourceLineEnd})
                                        </small>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {fertilityStatus.warnings.length > 0 && (
                            <div className="why-section warnings">
                                <h3>{t('why.warnings')}</h3>
                                <ul>
                                    {fertilityStatus.warnings.map((warning, i) => (
                                        <li key={i}>{warning[i18n.language as 'fr' | 'en']}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            onClick={() => setShowWhyModal(false)}
                        >
                            {t('common.close')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

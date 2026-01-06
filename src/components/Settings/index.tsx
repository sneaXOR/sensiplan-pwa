/**
 * Composant Settings - Paramètres de l'application
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './Settings.css';
import { setLanguage } from '../../i18n';
import {
    db,
    getOrCreateProfile,
    updateProfile,
    exportData,
    importData,
    deleteAllData,
} from '../../storage/db';
import type { UserProfile, TemperatureMethod } from '@sensiplan/rule-engine';

export default function Settings() {
    const { t, i18n } = useTranslation();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        async function loadProfile() {
            const p = await getOrCreateProfile();
            setProfile(p);
        }
        loadProfile();
    }, []);

    const handleLanguageChange = async (lang: 'fr' | 'en') => {
        setLanguage(lang);
        await updateProfile({ language: lang });
        if (profile) {
            setProfile({ ...profile, language: lang });
        }
    };

    const handleMethodChange = async (method: TemperatureMethod) => {
        await updateProfile({ temperatureMethod: method });
        if (profile) {
            setProfile({ ...profile, temperatureMethod: method });
        }
    };

    const handleCervixToggle = async () => {
        const newValue = !profile?.useCervixSign;
        await updateProfile({ useCervixSign: newValue });
        if (profile) {
            setProfile({ ...profile, useCervixSign: newValue });
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const data = await exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sensiplan-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setExporting(false);
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            await importData(data);
            // Recharger le profil
            const p = await getOrCreateProfile();
            setProfile(p);
            // Recharger la langue
            setLanguage(p.language as 'fr' | 'en');
        } catch (error) {
            console.error('Import error:', error);
            alert(t('errors.loadFailed'));
        } finally {
            setImporting(false);
            event.target.value = '';
        }
    };

    const handleDeleteAll = async () => {
        try {
            await deleteAllData();
            setShowDeleteConfirm(false);
            // Créer un nouveau profil par défaut
            const p = await getOrCreateProfile();
            setProfile(p);
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    if (!profile) {
        return <div>{t('common.loading')}</div>;
    }

    return (
        <div className="settings">
            <h2>{t('settings.title')}</h2>

            {/* Language */}
            <div className="settings-section">
                <label>{t('settings.language')}</label>
                <div className="language-options">
                    <button
                        className={`lang-option ${i18n.language === 'fr' ? 'selected' : ''}`}
                        onClick={() => handleLanguageChange('fr')}
                    >
                        🇫🇷 Français
                    </button>
                    <button
                        className={`lang-option ${i18n.language === 'en' ? 'selected' : ''}`}
                        onClick={() => handleLanguageChange('en')}
                    >
                        🇬🇧 English
                    </button>
                </div>
            </div>

            {/* Temperature Method */}
            <div className="settings-section">
                <label>{t('settings.temperatureMethod')}</label>
                <div className="method-options">
                    {(['oral', 'rectal', 'vaginal'] as TemperatureMethod[]).map((method) => (
                        <button
                            key={method}
                            className={`method-option ${profile.temperatureMethod === method ? 'selected' : ''}`}
                            onClick={() => handleMethodChange(method)}
                        >
                            {t(`settings.${method}`)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Cervix Sign Toggle */}
            <div className="settings-section">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={profile.useCervixSign}
                        onChange={handleCervixToggle}
                    />
                    {t('settings.useCervix')}
                </label>
            </div>

            {/* Data Section */}
            <div className="settings-section">
                <h3>{t('settings.data')}</h3>

                <div className="data-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={handleExport}
                        disabled={exporting}
                    >
                        {exporting ? '...' : t('settings.export')}
                    </button>

                    <label className="btn btn-secondary import-btn">
                        {importing ? '...' : t('settings.import')}
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            hidden
                            disabled={importing}
                        />
                    </label>
                </div>

                <button
                    className="btn btn-danger delete-btn"
                    onClick={() => setShowDeleteConfirm(true)}
                >
                    {t('settings.deleteAll')}
                </button>
            </div>

            {/* About */}
            <div className="settings-section about">
                <h3>{t('settings.about')}</h3>
                <p className="version">
                    {t('settings.version')}: 1.0.0
                </p>
                <p className="credits">
                    SensiPlan® — Méthode sympto-thermique<br />
                    Malteser Arbeitsgruppe NFP
                </p>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>⚠️ {t('settings.deleteAll')}</h2>
                        <p>{t('settings.deleteConfirm')}</p>
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowDeleteConfirm(false)}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleDeleteAll}
                            >
                                {t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

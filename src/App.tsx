import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './App.css';
import { setLanguage } from './i18n';
import DailyEntry from './components/DailyEntry';
import Calendar from './components/Calendar';
import Settings from './components/Settings';
import { db, getOrCreateProfile } from './storage/db';
import type { UserProfile } from '@sensiplan/rule-engine';

type View = 'today' | 'calendar' | 'settings';

function App() {
    const { t, i18n } = useTranslation();
    const [currentView, setCurrentView] = useState<View>('today');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Charger le profil au démarrage
    useEffect(() => {
        async function loadProfile() {
            try {
                const p = await getOrCreateProfile();
                setProfile(p);
                // Synchroniser la langue
                if (p.language !== i18n.language) {
                    setLanguage(p.language as 'fr' | 'en');
                }
            } catch (error) {
                console.error('Error loading profile:', error);
            } finally {
                setLoading(false);
            }
        }
        loadProfile();
    }, [i18n.language]);

    const handleLanguageToggle = async () => {
        const newLang = i18n.language === 'fr' ? 'en' : 'fr';
        setLanguage(newLang);
        if (profile) {
            await db.profile.update('default', { language: newLang });
            setProfile({ ...profile, language: newLang });
        }
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner" />
                <p>{t('common.loading')}</p>
            </div>
        );
    }

    return (
        <div className="app">
            {/* Header */}
            <header className="app-header">
                <h1 className="app-title">{t('app.title')}</h1>
                <button
                    className="lang-toggle"
                    onClick={handleLanguageToggle}
                    aria-label={t('settings.language')}
                >
                    {i18n.language.toUpperCase()}
                </button>
            </header>

            {/* Main Content */}
            <main className="container">
                {currentView === 'today' && <DailyEntry />}
                {currentView === 'calendar' && <Calendar />}
                {currentView === 'settings' && <Settings />}
            </main>

            {/* Bottom Navigation */}
            <nav className="bottom-nav" role="navigation" aria-label="Navigation principale">
                <button
                    className={`nav-item ${currentView === 'today' ? 'active' : ''}`}
                    onClick={() => setCurrentView('today')}
                    aria-current={currentView === 'today' ? 'page' : undefined}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="12" x2="16" y2="14" />
                    </svg>
                    <span>{t('nav.today')}</span>
                </button>

                <button
                    className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`}
                    onClick={() => setCurrentView('calendar')}
                    aria-current={currentView === 'calendar' ? 'page' : undefined}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>{t('nav.calendar')}</span>
                </button>

                <button
                    className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
                    onClick={() => setCurrentView('settings')}
                    aria-current={currentView === 'settings' ? 'page' : undefined}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    <span>{t('nav.settings')}</span>
                </button>
            </nav>
        </div>
    );
}

export default App;

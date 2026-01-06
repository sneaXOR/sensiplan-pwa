import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './fr.json';
import en from './en.json';

// Récupérer la langue sauvegardée ou utiliser le français par défaut
const getSavedLanguage = (): string => {
    try {
        const saved = localStorage.getItem('sensiplan-language');
        return saved || 'fr';
    } catch {
        return 'fr';
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources: {
            fr: { translation: fr },
            en: { translation: en },
        },
        lng: getSavedLanguage(),
        fallbackLng: 'fr',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;

// Fonction pour sauvegarder la langue
export const setLanguage = (lang: 'fr' | 'en') => {
    i18n.changeLanguage(lang);
    try {
        localStorage.setItem('sensiplan-language', lang);
    } catch {
        // localStorage non disponible
    }
};

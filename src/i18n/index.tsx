// GORewrite i18n - Core module

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { ja, TranslationKey } from './ja';
import { en } from './en';
import { zh } from './zh';

export type Language = 'ja' | 'en' | 'zh';

const translations: Record<Language, Record<TranslationKey, string>> = {
    ja,
    en,
    zh,
};

const STORAGE_KEY = 'gorw_language';

// Get initial language from localStorage or browser
function getInitialLanguage(): Language {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && (saved === 'ja' || saved === 'en' || saved === 'zh')) {
            return saved;
        }
    } catch (e) {
        // localStorage not available
    }

    // Default to Japanese
    return 'ja';
}

// Language Context
interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

// Language Provider Component
interface LanguageProviderProps {
    children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
    const [language, setLanguageState] = useState<Language>(getInitialLanguage);

    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang);
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (e) {
            // localStorage not available
        }
    }, []);

    const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
        let text = translations[language][key] || translations['ja'][key] || key;

        // Replace parameters like {path}, {status}, etc.
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            });
        }

        return text;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

// Custom hook to use translations
export function useTranslation() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
}

// Language names for UI display
export const languageNames: Record<Language, string> = {
    ja: '日本語',
    en: 'English',
    zh: '中文',
};

// Re-export types
export type { TranslationKey };

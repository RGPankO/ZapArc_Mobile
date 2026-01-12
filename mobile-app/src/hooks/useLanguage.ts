// useLanguage Hook
// Re-exports the language context hook for components to use

import { useAppLanguage } from '../contexts/LanguageContext';

// Re-export the context hook as useLanguage for backward compatibility
export const useLanguage = useAppLanguage;

// Re-export types from the service
export type { SupportedLanguage, TranslationParams } from '../services/i18nService';

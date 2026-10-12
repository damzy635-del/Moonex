import enCommon from './locales/en/common.json';

/**
 * English-first translation registry.
 * Keep interface copy in locale JSON files so a full i18next adapter can be added
 * without coupling the UI components to provider/backend code.
 */
const resources = { en: { common: enCommon } } as const;
type Locale = keyof typeof resources;
type CommonKey = keyof typeof enCommon;

export function translate(key: CommonKey, locale: Locale = 'en'): string {
  return resources[locale].common[key] ?? resources.en.common[key];
}

export const defaultLocale: Locale = 'en';
export const supportedLocales: Locale[] = ['en'];

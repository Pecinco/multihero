import type { UserState } from '../types';
import { PRIVACY_POLICY_ES, TERMS_AND_CONDITIONS_ES } from './multiheroLegalEs';
import { PRIVACY_POLICY_EN, TERMS_AND_CONDITIONS_EN } from './multiheroLegalEn';
import { PRIVACY_POLICY_CA, TERMS_AND_CONDITIONS_CA } from './multiheroLegalCa';
import { PRIVACY_POLICY_FR, TERMS_AND_CONDITIONS_FR } from './multiheroLegalFr';

export type AppLanguage = UserState['language'];

const LEGAL: Record<AppLanguage, { terms: string; privacy: string }> = {
  Spanish: { terms: TERMS_AND_CONDITIONS_ES, privacy: PRIVACY_POLICY_ES },
  English: { terms: TERMS_AND_CONDITIONS_EN, privacy: PRIVACY_POLICY_EN },
  Catalan: { terms: TERMS_AND_CONDITIONS_CA, privacy: PRIVACY_POLICY_CA },
  French: { terms: TERMS_AND_CONDITIONS_FR, privacy: PRIVACY_POLICY_FR },
  Portuguese: { terms: TERMS_AND_CONDITIONS_EN, privacy: PRIVACY_POLICY_EN },
  German: { terms: TERMS_AND_CONDITIONS_EN, privacy: PRIVACY_POLICY_EN },
  Dutch: { terms: TERMS_AND_CONDITIONS_EN, privacy: PRIVACY_POLICY_EN },
  Russian: { terms: TERMS_AND_CONDITIONS_EN, privacy: PRIVACY_POLICY_EN },
};

/** Resol el text legal segons l'idioma actiu d'i18n. Idiomes sense traducció pròpia usen el text anglès. */
export function getLegalDocuments(language: string): { terms: string; privacy: string } {
  if (language in LEGAL) {
    return LEGAL[language as AppLanguage];
  }
  return LEGAL.English;
}

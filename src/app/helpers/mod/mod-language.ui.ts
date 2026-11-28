import { t } from '@helpers/i18n/i18n';
import {
  i18nLanguages,
  languageChoice,
  languageChoiceKey,
  languageEnglishOnlyApply,
  languageModApply,
  languageReset,
} from '@helpers/i18n/i18n-language';
import { modsInstalled, modUsableBundle } from '@helpers/mod/mod-registry';
import { isGameStateReady, saveGameState } from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import type { LanguageChoice, LanguagePickerOption } from '@interfaces';

// Returns why the chosen mod language couldn't be used, after falling back to English.
export function modLanguageApply(): string | undefined {
  const choice = languageChoice();
  if (choice.source !== 'mod') return undefined;

  const translations = modUsableBundle(choice.modId)?.translations;
  if (translations) {
    languageModApply(translations);
    return undefined;
  }

  languageReset();
  languageEnglishOnlyApply();
  const mod = modsInstalled().find((m) => m.manifest?.id === choice.modId);
  return mod ? mod.errors.join(' ') : `Missing mod: ${choice.modId}`;
}

function modLanguageOptions(): LanguagePickerOption[] {
  return modsInstalled().flatMap((mod) => {
    const translations = mod.bundle?.translations;
    if (!mod.manifest || !translations || mod.errors.length > 0) return [];

    const choice: LanguageChoice = {
      source: 'mod',
      modId: mod.manifest.id,
      locale: translations.locale,
    };
    return [
      {
        key: languageChoiceKey(choice),
        label: t('options.language.fromMod', {
          name: translations.languageName,
        }),
        choice,
      },
    ];
  });
}

export function languagePickerOptions(): LanguagePickerOption[] {
  const base = i18nLanguages().map((language) => {
    const choice: LanguageChoice = { source: 'base', locale: language.locale };
    return {
      key: languageChoiceKey(choice),
      label: language.languageName,
      choice,
    };
  });
  return [...base, ...modLanguageOptions()];
}

// Text is read once at load, so a new language takes a reload.
export async function languageChoose(choice: LanguageChoice): Promise<void> {
  if (languageChoiceKey(choice) === languageChoiceKey(languageChoice())) return;

  setOption('language', choice);
  await languageReload();
}

// Saved first, since the reload would otherwise drop ticks since the last autosave.
export async function languageReload(): Promise<void> {
  if (isGameStateReady()) await saveGameState();
  location.reload();
}

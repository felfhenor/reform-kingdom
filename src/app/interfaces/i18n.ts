export type I18nParams = Record<string, string | number | null | undefined>;

export type I18nListType = 'and' | 'or';

export type I18nEnumGroup =
  | 'rarity'
  | 'element'
  | 'elementCombination'
  | 'equipmentType'
  | 'equipmentSlot'
  | 'lootSource'
  | 'riskLevel'
  | 'skillTreeNodeKind'
  | 'skillTreeRow'
  | 'rewardKind';

export type I18nFlatStrings = Record<string, string>;

// Keyed by content type, then English name, then field path (e.g. `techniques.0.combatMessage`).
export type I18nContentFields = Record<string, string>;
export type I18nContentTranslations = Record<
  string,
  Record<string, I18nContentFields>
>;

export type I18nLanguageInfo = {
  locale: string;
  languageName: string;
};

export type I18nLanguageData = I18nLanguageInfo & {
  ui: I18nFlatStrings;
  content: I18nContentTranslations;
  nodes: I18nFlatStrings;
  // The English each line was translated from, so a changed English line can be flagged.
  sources: I18nContentTranslations;
  uiSources: I18nFlatStrings;
};

export type I18nParseResult = {
  language?: I18nLanguageData;
  errors: string[];
};

export type I18nValidateResult = {
  errors: string[];
  warnings: string[];
};

export type I18nEnglishContentLookup = (
  type: string,
  name: string,
) => Record<string, unknown> | undefined;

export type LanguageChoice =
  | { source: 'base'; locale: string }
  | { source: 'mod'; modId: string; locale: string };

// Names carry a prefix or suffix that keeps them globally unique ("Explorer: Analyze I", "Commission - Simple Armor"); the short name drops it.
const CONTENT_SHORT_NAME_RULES: Record<string, (name: string) => string> = {
  recipe: (name) => name.slice(name.indexOf(':') + 1).trim(),
  skilltreenode: (name) => name.slice(name.indexOf(':') + 1).trim(),
  edict: (name) => name.replace(/^Edict of (the )?/, ''),
  commissionoffer: (name) => name.replace(/^Commission - /, ''),
  caravan: (name) => name.split(' - ')[0],
};

export function contentShortNameEnglish(
  type: string,
  name: string,
): string | undefined {
  return CONTENT_SHORT_NAME_RULES[type]?.(name);
}

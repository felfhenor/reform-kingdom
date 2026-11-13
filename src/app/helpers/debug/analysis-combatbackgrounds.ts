import { getEntriesByType } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  EncounterContent,
  EncounterRandomContent,
  HasCombatBackground,
  IsContentItem,
  TownContent,
} from '@interfaces';
import { COMBAT_BACKGROUNDS } from '@interfaces';

function checkCombatBackground(
  entry: IsContentItem & HasCombatBackground,
): AnalysisCheck {
  const valid = (COMBAT_BACKGROUNDS as readonly string[]).includes(
    entry.combatBackground,
  );
  return {
    id: `combatbackgrounds:${entry.id}`,
    label: entry.name,
    status: valid ? 'pass' : 'fail',
    message: valid
      ? `${entry.name} fights on ${entry.combatBackground}.`
      : `${entry.name} has no valid combatBackground (got "${entry.combatBackground}").`,
  };
}

export function runCombatBackgroundsAnalysis(): AnalysisRunResult {
  const entries = [
    ...getEntriesByType<EncounterContent>('encounter'),
    ...getEntriesByType<EncounterRandomContent>('encounterrandom'),
    ...getEntriesByType<TownContent>('town'),
  ];
  const checks = entries.map(checkCombatBackground);
  const failures = checks.filter((c) => c.status !== 'pass').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every combat location (${entries.length}) has a combat background.`
        : `${failures} combat location(s) missing a combat background.`,
  };
}

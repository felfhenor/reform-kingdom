import { getEntriesByType } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  EncounterContent,
  EncounterRandomContent,
  ExchangeNodeContent,
  GatheringContent,
  HasNodeBackground,
  IsContentItem,
  TownContent,
} from '@interfaces';
import { NODE_BACKGROUNDS } from '@interfaces';

function checkNodeBackground(
  entry: IsContentItem & HasNodeBackground,
): AnalysisCheck {
  const valid = (NODE_BACKGROUNDS as readonly string[]).includes(
    entry.background,
  );
  return {
    id: `nodebackgrounds:${entry.id}`,
    label: entry.name,
    status: valid ? 'pass' : 'fail',
    message: valid
      ? `${entry.name} uses ${entry.background}.`
      : `${entry.name} has no valid background (got "${entry.background}").`,
  };
}

export function runNodeBackgroundsAnalysis(): AnalysisRunResult {
  const entries = [
    ...getEntriesByType<EncounterContent>('encounter'),
    ...getEntriesByType<EncounterRandomContent>('encounterrandom'),
    ...getEntriesByType<TownContent>('town'),
    ...getEntriesByType<GatheringContent>('gathering'),
    ...getEntriesByType<ExchangeNodeContent>('exchangenode'),
  ];
  const checks = entries.map(checkNodeBackground);
  const failures = checks.filter((c) => c.status !== 'pass').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every background location (${entries.length}) has a node background.`
        : `${failures} background location(s) missing a node background.`,
  };
}

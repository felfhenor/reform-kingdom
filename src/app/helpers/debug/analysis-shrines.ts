/**
 * Validates domain rules specific to Shrine content: every shrine has at
 * least one level, each level's globalEffectId resolves to a GlobalEffect
 * flagged isShrineBuff, and no two shrine levels (within the same shrine or
 * across shrines) share a globalEffectId - "Pray"'s buff-replacement logic
 * (world-node-shrine.ui.ts) assumes a buff is uniquely attributable to one
 * shrine tier.
 */

import { getEntriesByType, getEntry } from '@helpers/content/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  GlobalEffectContent,
  GlobalEffectId,
  ShrineContent,
} from '@interfaces';

type TierRef = { shrineName: string; tier: number };

function checkShrine(
  shrine: ShrineContent,
  refsByEffectId: Map<GlobalEffectId, TierRef[]>,
): AnalysisCheck {
  const id = `shrines:${shrine.id}`;

  if (shrine.levels.length === 0) {
    return {
      id,
      label: shrine.name,
      status: 'fail',
      message: `${shrine.name} has no authored levels - it can never be developed or prayed at.`,
    };
  }

  const problems: string[] = [];

  shrine.levels.forEach((level, index) => {
    const tier = index + 1;
    const content = getEntry<GlobalEffectContent>(level.globalEffectId);

    if (!content) {
      problems.push(
        `tier ${tier}'s globalEffectId does not resolve to any GlobalEffect`,
      );
      return;
    }

    if (!content.isShrineBuff) {
      problems.push(
        `tier ${tier}'s buff "${content.name}" is missing isShrineBuff: true, so praying elsewhere won't replace it`,
      );
    }

    const others = (refsByEffectId.get(level.globalEffectId) ?? []).filter(
      (ref) => !(ref.shrineName === shrine.name && ref.tier === tier),
    );
    if (others.length > 0) {
      const otherLabels = others
        .map((ref) => `${ref.shrineName} tier ${ref.tier}`)
        .join(', ');
      problems.push(
        `tier ${tier}'s buff "${content.name}" is also granted by ${otherLabels}`,
      );
    }
  });

  if (problems.length > 0) {
    return {
      id,
      label: shrine.name,
      status: 'fail',
      message: `${shrine.name}: ${problems.join('; ')}.`,
    };
  }

  return {
    id,
    label: shrine.name,
    status: 'pass',
    message: `${shrine.name}: ${shrine.levels.length} level(s), each with a unique isShrineBuff-flagged buff.`,
  };
}

export function runShrinesAnalysis(): AnalysisRunResult {
  const shrines = getEntriesByType<ShrineContent>('shrine');

  const refsByEffectId = new Map<GlobalEffectId, TierRef[]>();
  shrines.forEach((shrine) => {
    shrine.levels.forEach((level, index) => {
      const refs = refsByEffectId.get(level.globalEffectId) ?? [];
      refs.push({ shrineName: shrine.name, tier: index + 1 });
      refsByEffectId.set(level.globalEffectId, refs);
    });
  });

  const checks = shrines.map((shrine) => checkShrine(shrine, refsByEffectId));
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every shrine (${shrines.length} checked) has valid, uniquely-owned, isShrineBuff-flagged levels.`
        : `${failures} of ${shrines.length} shrine(s) have a level or buff configuration problem.`,
  };
}

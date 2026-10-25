import { getEntriesByType, getEntry } from '@helpers/content/content';
import { allMaps } from '@helpers/maps';
import {
  isWorldNodeHidden,
  worldNodeByName,
  worldNodeCollectibleGateIds,
  worldNodeLookup,
} from '@helpers/world-node/world-nodes';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  CaravanTrade,
  CaravanTraderContent,
  CollectibleContent,
  RumorContent,
  TrainerTeachingContent,
  WorldNodeEntry,
} from '@interfaces';

function isSecretNode(entry: WorldNodeEntry): boolean {
  return (
    isWorldNodeHidden(entry) || worldNodeCollectibleGateIds(entry).length > 0
  );
}

function rumorSubjectProblem(rumor: RumorContent): string | undefined {
  const subject = rumor.subject;
  switch (subject.kind) {
    case 'Node': {
      const entry = worldNodeByName(subject.nodeName);
      if (!entry) return `node "${subject.nodeName}" is not on any map`;
      return isSecretNode(entry)
        ? undefined
        : `node "${subject.nodeName}" is neither hidden nor collectible-gated`;
    }
    case 'Collectible':
      return getEntry<CollectibleContent>(subject.collectibleId)
        ? undefined
        : `collectible "${subject.collectibleId}" does not exist`;
    case 'TrainerTeaching':
      return getEntry<TrainerTeachingContent>(subject.trainerTeachingId)
        ? undefined
        : `teaching "${subject.trainerTeachingId}" does not exist`;
  }
}

function checkRumor(rumor: RumorContent): AnalysisCheck {
  const problems = [
    rumorSubjectProblem(rumor),
    rumor.description.trim() === '' ? 'it has no hint text' : undefined,
    rumor.requireMapVisit !== '' && !allMaps().has(rumor.requireMapVisit)
      ? `requireMapVisit "${rumor.requireMapVisit}" is not a map`
      : undefined,
  ].filter((problem) => problem !== undefined);

  return {
    id: `rumors:${rumor.id}`,
    label: rumor.name,
    status: problems.length === 0 ? 'pass' : 'fail',
    message:
      problems.length === 0
        ? `${rumor.name} points at a real secret.`
        : `${rumor.name}: ${problems.join('; ')}.`,
  };
}

// A sold reveal marks the node discovered, which only lifts `hidden` - a collectible gate stays shut.
function rumorTradeProblem(trade: CaravanTrade): string | undefined {
  const rumor = getEntry<RumorContent>(trade.rumorId!);
  if (!rumor) return `rumor "${trade.rumorId}" does not exist`;
  if (trade.type !== 'sell') return `${rumor.name} must be a sell trade`;
  if (trade.value <= 0 || (trade.tokenCost ?? 0) <= 0) {
    return `${rumor.name} must cost both gold and Trader Scrip`;
  }
  if (rumor.subject.kind !== 'Node') {
    return `${rumor.name} has no node to reveal`;
  }

  const entry = worldNodeByName(rumor.subject.nodeName);
  const revealable =
    !!entry &&
    isWorldNodeHidden(entry) &&
    worldNodeCollectibleGateIds(entry).length === 0;
  return revealable
    ? undefined
    : `${rumor.name} must point at a hidden, ungated node to be sold`;
}

function checkRumorTrades(trader: CaravanTraderContent): AnalysisCheck[] {
  return trader.trades
    .filter((trade) => trade.rumorId)
    .map((trade, index) => {
      const problem = rumorTradeProblem(trade);
      return {
        id: `rumors:trade:${trader.id}:${index}`,
        label: `${trader.name} rumor`,
        status: problem ? 'fail' : 'pass',
        message: problem
          ? `${trader.name}: ${problem}.`
          : `${trader.name} sells a valid reveal.`,
      };
    });
}

// A rumor about a gate's collectible covers every node that collectible opens.
function isSecretCovered(
  entry: WorldNodeEntry,
  rumors: RumorContent[],
): boolean {
  const gateIds = worldNodeCollectibleGateIds(entry);
  return rumors.some(({ subject }) =>
    subject.kind === 'Node'
      ? subject.nodeName === entry.nodeName
      : subject.kind === 'Collectible' &&
        gateIds.includes(subject.collectibleId),
  );
}

function checkSecretCoverage(rumors: RumorContent[]): AnalysisCheck[] {
  return Object.values(worldNodeLookup().byName)
    .filter((entry) => isSecretNode(entry) && !isSecretCovered(entry, rumors))
    .map((entry) => ({
      id: `rumors:coverage:${entry.nodeName}`,
      label: entry.nodeName,
      status: 'warning',
      message: `${entry.nodeName} is a secret no rumor hints at.`,
    }));
}

export function runRumorsAnalysis(): AnalysisRunResult {
  const rumors = getEntriesByType<RumorContent>('rumor');
  const checks = [
    ...rumors.map(checkRumor),
    ...getEntriesByType<CaravanTraderContent>('caravantrader').flatMap(
      checkRumorTrades,
    ),
    ...checkSecretCoverage(rumors),
  ];
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every rumor (${rumors.length} checked) and caravan reveal is valid.`
        : `${failures} rumor or reveal problem(s) found.`,
  };
}

/**
 * Validates exchange node content: every node is placed on a map exactly once
 * as an `ExchangeNode`, offers at least one exchange, and each exchange's
 * input, output and costs resolve to real content of the right type.
 */

import { getEntriesByType, getEntry } from '@helpers/content/content';
import { allMaps } from '@helpers/maps';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  EquipmentContent,
  ExchangeNodeContent,
  ExchangeNodeExchange,
  ItemContent,
  TiledMap,
} from '@interfaces';

function exchangeNodeMapPlacements(nodeName: string): string[] {
  const placements: string[] = [];

  allMaps().forEach((gameMap) => {
    (gameMap.data as TiledMap).layers.forEach((layer) => {
      (layer.objects ?? []).forEach((object) => {
        if (object.type === 'ExchangeNode' && object.name === nodeName) {
          placements.push(gameMap.name);
        }
      });
    });
  });

  return placements;
}

function isEquipment(id: string): boolean {
  return getEntry<EquipmentContent>(id)?.__type === 'equipment';
}

function isItem(id: string): boolean {
  return getEntry<ItemContent>(id)?.__type === 'item';
}

function exchangeInputKey(exchange: ExchangeNodeExchange): string {
  return exchange.kind === 'Equipment'
    ? `equipment:${exchange.inputEquipmentId}`
    : `item:${exchange.input.itemId}`;
}

function exchangeProblems(
  exchange: ExchangeNodeExchange,
  index: number,
): string[] {
  const problems: string[] = [];
  const label = `exchange ${index + 1}`;

  if (exchange.kind === 'Equipment') {
    if (!isEquipment(exchange.inputEquipmentId)) {
      problems.push(
        `${label} takes unknown equipment "${exchange.inputEquipmentId}"`,
      );
    }
    if (!isEquipment(exchange.outputEquipmentId)) {
      problems.push(
        `${label} gives unknown equipment "${exchange.outputEquipmentId}"`,
      );
    }
    if (exchange.inputEquipmentId === exchange.outputEquipmentId) {
      problems.push(`${label} exchanges an item for itself`);
    }
  } else {
    if (!isItem(exchange.input.itemId)) {
      problems.push(`${label} takes unknown item "${exchange.input.itemId}"`);
    }
    if (!isItem(exchange.output.itemId)) {
      problems.push(`${label} gives unknown item "${exchange.output.itemId}"`);
    }
    if (exchange.input.itemId === exchange.output.itemId) {
      problems.push(`${label} exchanges an item for itself`);
    }
    if (exchange.input.required <= 0) {
      problems.push(`${label} has a non-positive input quantity`);
    }
    if (exchange.output.quantity <= 0) {
      problems.push(`${label} has a non-positive output quantity`);
    }
  }

  if (exchange.costs.length === 0) problems.push(`${label} costs nothing`);
  exchange.costs.forEach((cost) => {
    if (!isItem(cost.itemId)) {
      problems.push(`${label} costs unknown item "${cost.itemId}"`);
    }
    if (cost.required <= 0) {
      problems.push(`${label} has a non-positive cost for "${cost.itemId}"`);
    }
  });

  return problems;
}

function exchangeNodeProblems(node: ExchangeNodeContent): string[] {
  const problems: string[] = [];

  const placements = exchangeNodeMapPlacements(node.name);
  if (placements.length === 0) problems.push('is not placed on any map');
  if (placements.length > 1) {
    problems.push(
      `is placed ${placements.length} times (${placements.join(', ')})`,
    );
  }

  if (node.exchanges.length === 0) problems.push('offers no exchanges');

  const seenInputs = new Set<string>();
  node.exchanges.forEach((exchange, index) => {
    problems.push(...exchangeProblems(exchange, index));

    // Two exchanges with the same input would make the modal ambiguous about which one a click applies.
    const key = exchangeInputKey(exchange);
    if (seenInputs.has(key)) {
      problems.push(`exchange ${index + 1} reuses an earlier exchange's input`);
    }
    seenInputs.add(key);
  });

  return problems;
}

export function runExchangeNodesAnalysis(): AnalysisRunResult {
  const nodes = getEntriesByType<ExchangeNodeContent>('exchangenode');

  const checks: AnalysisCheck[] = nodes.map((node) => {
    const problems = exchangeNodeProblems(node);
    const id = `exchangenodes:${node.id}`;

    if (problems.length > 0) {
      return {
        id,
        label: node.name,
        status: 'fail',
        message: `${node.name}: ${problems.join('; ')}.`,
      };
    }

    return {
      id,
      label: node.name,
      status: 'pass',
      message: `${node.name}: ${node.exchanges.length} valid exchange(s).`,
    };
  });

  const failures = checks.filter((check) => check.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? `Every exchange node (${nodes.length} checked) is placed once and has valid exchanges.`
        : `${failures} of ${nodes.length} exchange node(s) have a placement or exchange problem.`,
  };
}

// Runs one scenario end to end; shared by run.ts's serial path and worker.ts.
// Must be the first import - installs shims before any `@helpers` import.
import { settle } from './shims';

import { getEntry } from '@helpers/content';
import { gameReset, gameStart } from '@helpers/game-init';
import { grandfatherGatherNodeDiscoveries } from '@helpers/gather-node-discovery';
import { migrateGameState } from '@helpers/migrate';
import { createCharacter, setParty } from '@helpers/party';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeDiscover } from '@helpers/world-node-discovery';
import {
  isWorldNodeHidden,
  worldNodeLookup,
  worldNodesOfType,
} from '@helpers/world-nodes';
import type { JobContent, JobId } from '@interfaces';
import { runScenario } from './driver';
import { configureStrategyDecree } from './strategy';
import type { PartyComp, ScenarioConfig, SimResult } from './types';
import type { LoggedRuntimeError, LoggedStonewall } from './worker-protocol';

export type ScenarioOutcome = {
  result?: SimResult;
  crashed: boolean;
  stonewalls: LoggedStonewall[];
  runtimeErrors: LoggedRuntimeError[];
};

// `createCharacter` takes a `JobId`, but comps are authored by job name
// (matches `gamedata/job/*.yml`) - resolve once against loaded content.
function resolveJobId(jobName: string): JobId {
  const job = getEntry<JobContent>(jobName);
  if (!job) {
    throw new Error(
      `Unknown job "${jobName}" - check it matches a gamedata/job/*.yml name.`,
    );
  }
  return job.id;
}

// The simulator never clicks anything, so hidden nodes need discovering up
// front to get any coverage of that content at all.
function discoverHiddenNodesForSimulation(): void {
  Object.values(worldNodeLookup().byName)
    .filter(isWorldNodeHidden)
    .forEach((entry) => worldNodeDiscover(entry.nodeName));
}

// A `GatherMaterial` clause needs its node already discovered, and the
// simulator never travels there to trigger that itself - grandfather every
// GatherNode as discovered instead (same helper `migrate.ts` uses for the
// analogous legacy-save case).
function discoverAllGatherNodesForSimulation(): void {
  updateGamestate((state) => {
    state.discoveredGatherNodes = grandfatherGatherNodeDiscoveries(
      worldNodesOfType('GatherNode').map((entry) => entry.nodeName),
    );
    return state;
  });
}

// Builds a fresh `GameState` and starts a new game with `comp`'s party.
// `settle()` lets each fire-and-forget `updateGamestate` write land before
// the next step reads state.
async function setUpNewGame(comp: PartyComp): Promise<void> {
  gameReset();
  migrateGameState();
  await settle();

  const party = comp.jobNames.map((jobName, i) =>
    createCharacter(`${comp.label} #${i + 1}`, resolveJobId(jobName)),
  );
  setParty(party);
  await settle();

  await gameStart();
  await settle();
  await settle();

  discoverHiddenNodesForSimulation();
  discoverAllGatherNodesForSimulation();
  await settle();
}

function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((arg) =>
      arg instanceof Error ? (arg.stack ?? arg.message) : String(arg),
    )
    .join(' ');
}

// Captures stonewalls/console output/exceptions instead of writing or
// printing them directly, so the caller decides how they get logged.
export async function executeScenario(
  scenario: ScenarioConfig,
  verbose: boolean,
): Promise<ScenarioOutcome> {
  const label = `${scenario.comp.label} (${scenario.strategy} trial ${scenario.trial})`;
  const stonewalls: LoggedStonewall[] = [];
  const runtimeErrors: LoggedRuntimeError[] = [];

  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args: unknown[]) => {
    runtimeErrors.push({
      kind: 'ConsoleError',
      message: formatConsoleArgs(args),
    });
    if (verbose) originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    runtimeErrors.push({
      kind: 'ConsoleWarn',
      message: formatConsoleArgs(args),
    });
    if (verbose) originalWarn(...args);
  };

  try {
    if (verbose) console.log(`[${label}] party starting up...`);

    await setUpNewGame(scenario.comp);
    configureStrategyDecree();
    await settle();

    const result = runScenario(
      scenario,
      (event, stateSnapshot) => stonewalls.push({ event, stateSnapshot }),
      verbose,
    );

    return { result, crashed: false, stonewalls, runtimeErrors };
  } catch (error) {
    // A crash shouldn't take down the whole batch - report it and let the
    // caller move on.
    runtimeErrors.push({
      kind: 'Exception',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      stateSnapshot: structuredClone(gamestate()),
    });
    return { result: undefined, crashed: true, stonewalls, runtimeErrors };
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

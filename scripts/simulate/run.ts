// Must be the first import - installs the window/localStorage/indexedDB
// shims every subsequent `@helpers` import needs at module-load time.
import { settle, silenceDebugLogging } from './shims';

import { getEntry } from '@helpers/content';
import { gameReset, gameStart } from '@helpers/game-init';
import { migrateGameState } from '@helpers/migrate';
import { createCharacter, setParty } from '@helpers/party';
import { gamestate } from '@helpers/state-game';
import type { JobContent, JobId } from '@interfaces';
import { bootstrapContent } from './bootstrap';
import { DEFAULT_TICK_BUDGET, DEFAULT_TRIALS } from './constants';
import { runScenario } from './driver';
import type { RunLogger } from './logger';
import { createRunLogger } from './logger';
import { curatedPartyComps, exhaustivePartyComps } from './party-comps';
import {
  buildLeaderboard,
  printLeaderboard,
  printSummaryTable,
  summarizeResults,
  writeLeaderboardFiles,
  writeSummaryFiles,
} from './report';
import { configureStrategyDecree } from './strategy';
import type {
  PartyComp,
  RunOptions,
  ScenarioConfig,
  SimResult,
  StrategyName,
} from './types';

const ALL_STRATEGIES: StrategyName[] = ['optimal', 'average', 'suboptimal'];

function parseArgs(argv: string[]): RunOptions {
  const args = new Map<string, string>();
  argv.forEach((arg) => {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) args.set(match[1], match[2]);
  });

  const mode = args.get('mode') === 'exhaustive' ? 'exhaustive' : 'curated';
  const strategies = args.get('strategies')
    ? (args.get('strategies')!.split(',') as StrategyName[])
    : ALL_STRATEGIES;

  return {
    mode,
    trials: Number(args.get('trials') ?? DEFAULT_TRIALS),
    tickBudget: Number(args.get('tick-budget') ?? DEFAULT_TICK_BUDGET),
    strategies,
    verbose: args.has('verbose'),
  };
}

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

// Builds a fresh `GameState` and starts a new game with `comp`'s party -
// mutators here are called *outside* a `gamestateTickStart`/`End` bracket,
// so each one is a fire-and-forget `updateGamestate` call; `settle()` lets
// each pending write land before the next step reads state.
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
}

async function runOneScenario(
  scenario: ScenarioConfig,
  logger: RunLogger,
): Promise<SimResult> {
  await setUpNewGame(scenario.comp);
  configureStrategyDecree(scenario.strategy);
  await settle();

  return runScenario(scenario, (event, snapshot) =>
    logger.logStonewall(scenario, event, snapshot),
  );
}

// The game's own `error()`/`warn()` helpers (`@helpers/logging`) print
// straight to the console with no scenario/tick context and no record -
// this captures calls made while `fn` is in flight and routes them into
// `runtime-errors.jsonl` instead, tagged to `scenario`. Only echoed to the
// real console when `verbose`, so a default run isn't flooded with noise
// from every scenario.
function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((arg) => (arg instanceof Error ? (arg.stack ?? arg.message) : String(arg)))
    .join(' ');
}

async function withConsoleCapture<T>(
  scenario: ScenarioConfig,
  logger: RunLogger,
  verbose: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    logger.logRuntimeError(scenario, 'ConsoleError', formatConsoleArgs(args));
    if (verbose) originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    logger.logRuntimeError(scenario, 'ConsoleWarn', formatConsoleArgs(args));
    if (verbose) originalWarn(...args);
  };

  try {
    return await fn();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.verbose) silenceDebugLogging();

  console.log(`Bootstrapping content...`);
  bootstrapContent();

  const comps =
    options.mode === 'exhaustive'
      ? exhaustivePartyComps()
      : curatedPartyComps();

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const logger = createRunLogger(runId);

  console.log(
    `Running ${comps.length} comp(s) x ${options.strategies.length} strategy(ies) x ${options.trials} trial(s), ` +
      `tick budget ${options.tickBudget} each...`,
  );

  const results: SimResult[] = [];
  let failedScenarios = 0;
  for (const comp of comps) {
    for (const strategy of options.strategies) {
      for (let trial = 1; trial <= options.trials; trial++) {
        const scenario: ScenarioConfig = {
          comp,
          strategy,
          trial,
          tickBudget: options.tickBudget,
        };

        try {
          const result = await withConsoleCapture(
            scenario,
            logger,
            options.verbose,
            () => runOneScenario(scenario, logger),
          );
          results.push(result);
        } catch (error) {
          // One scenario crashing shouldn't take down the whole batch -
          // log it with whatever state was last committed (driver.ts
          // guarantees `gamestateTickEnd()` ran before this throw
          // propagated) and move on to the next scenario.
          failedScenarios += 1;
          logger.logRuntimeError(
            scenario,
            'Exception',
            error instanceof Error ? error.message : String(error),
            error instanceof Error ? error.stack : undefined,
            structuredClone(gamestate()),
          );
          console.error(
            `Scenario crashed: ${scenario.comp.label} (${scenario.strategy}, trial ${scenario.trial}) - see runtime-errors.jsonl. Continuing.`,
          );
        }
      }
    }
  }

  if (failedScenarios > 0) {
    console.log(`\n${failedScenarios} scenario(s) crashed - see runtime-errors.jsonl.`);
  }

  const summaries = summarizeResults(results);
  printSummaryTable(summaries);
  writeSummaryFiles(logger.logDir, summaries);

  const leaderboard = buildLeaderboard(results);
  printLeaderboard(leaderboard);
  writeLeaderboardFiles(logger.logDir, leaderboard);

  const chokePoints = summaries.filter((s) => s.isChokePoint);
  console.log(`\nLogs written to ${logger.logDir}`);
  if (chokePoints.length > 0) {
    console.log(
      `${chokePoints.length} comp/strategy combination(s) hit a consistent choke point:`,
    );
    chokePoints.forEach((c) => console.log(`  - ${c.comp} (${c.strategy})`));
  } else {
    console.log('No consistent choke points found.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

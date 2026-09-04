// Must be the first import - installs shims before any `@helpers` import.
// Only needed here for the `--workers=1` serial path; each forked worker
// installs its own copy.
import { silenceDebugLogging } from './shims';

import { fork, type ChildProcess } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { bootstrapContent } from './bootstrap';
import {
  DEFAULT_SEED_CHECKPOINT_LEVELS,
  DEFAULT_TICK_BUDGET,
  DEFAULT_TRIALS,
} from './constants';
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
import type { ScenarioOutcome } from './scenario-runner';
import { executeScenario } from './scenario-runner';
import { findSeedsAtLevel, resolveSeedsDir, seedsDirFor } from './seeds';
import type {
  PartyComp,
  RunOptions,
  ScenarioConfig,
  SimResult,
  StrategyName,
} from './types';
import type { WorkerRequest, WorkerResponse } from './worker-protocol';

const ALL_STRATEGIES: StrategyName[] = ['periodic-craft', 'always-craft'];

// A malformed value here used to become `NaN`, which made `runParallel`
// spawn zero workers and hang forever with no error - fail fast instead.
function parseOptionalPositiveInt(
  value: string | undefined,
  flagName: string,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${flagName} must be a positive integer, got "${value}"`);
  }
  return parsed;
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  flagName: string,
): number {
  return parseOptionalPositiveInt(value, flagName) ?? fallback;
}

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
    trials: parsePositiveInt(args.get('trials'), DEFAULT_TRIALS, 'trials'),
    tickBudget: parsePositiveInt(
      args.get('tick-budget'),
      DEFAULT_TICK_BUDGET,
      'tick-budget',
    ),
    strategies,
    verbose: args.has('verbose'),
    workers: parsePositiveInt(args.get('workers'), os.cpus().length, 'workers'),
    dumpSeeds: args.has('dump-seeds'),
    dumpIntervalLevels: parsePositiveInt(
      args.get('dump-interval'),
      DEFAULT_SEED_CHECKPOINT_LEVELS,
      'dump-interval',
    ),
    resumeSeed: args.get('resume-seed'),
    resumeLevel: parseOptionalPositiveInt(
      args.get('resume-level'),
      'resume-level',
    ),
    resumeSeedsDir: args.get('resume-seeds-dir'),
  };
}

function buildFreshScenarios(
  options: RunOptions,
  seedsDir?: string,
): ScenarioConfig[] {
  const comps: PartyComp[] =
    options.mode === 'exhaustive'
      ? exhaustivePartyComps()
      : curatedPartyComps();

  const scenarios: ScenarioConfig[] = [];
  comps.forEach((comp) => {
    options.strategies.forEach((strategy) => {
      for (let trial = 1; trial <= options.trials; trial++) {
        scenarios.push({
          comp,
          strategy,
          trial,
          tickBudget: options.tickBudget,
          dumpSeedsDir: seedsDir,
          dumpIntervalLevels: options.dumpIntervalLevels,
        });
      }
    });
  });
  return scenarios;
}

// A resumed scenario's `comp` only carries a label for reporting - the seed
// already has the real party baked in, so `jobNames` is never read for it.
function compFromSeedFile(seedFile: string): PartyComp {
  return { label: path.basename(seedFile, '.json'), jobNames: [] };
}

// `seedsDir` (only set when `--dump-seeds` is also passed) lets a resumed
// run itself be checkpointed further, e.g. resume a batch at L20 and dump its own new checkpoints.
function buildResumeScenarios(
  options: RunOptions,
  seedPaths: string[],
  seedsDir?: string,
): ScenarioConfig[] {
  const scenarios: ScenarioConfig[] = [];
  seedPaths.forEach((seedPath) => {
    options.strategies.forEach((strategy) => {
      for (let trial = 1; trial <= options.trials; trial++) {
        scenarios.push({
          comp: compFromSeedFile(seedPath),
          strategy,
          trial,
          tickBudget: options.tickBudget,
          seedPath,
          dumpSeedsDir: seedsDir,
          dumpIntervalLevels: options.dumpIntervalLevels,
        });
      }
    });
  });
  return scenarios;
}

function buildScenarios(
  options: RunOptions,
  seedsDir?: string,
): ScenarioConfig[] {
  if (options.resumeSeed) {
    const resolved = path.resolve(options.resumeSeed);
    if (!fs.existsSync(resolved)) {
      throw new Error(`--resume-seed file not found: ${resolved}`);
    }
    return buildResumeScenarios(options, [resolved], seedsDir);
  }

  if (options.resumeLevel !== undefined) {
    const dir = resolveSeedsDir(options.resumeSeedsDir);
    const seedPaths = findSeedsAtLevel(dir, options.resumeLevel);
    if (seedPaths.length === 0) {
      throw new Error(
        `No seeds at level ${options.resumeLevel} found in ${dir}`,
      );
    }
    console.log(
      `Resuming ${seedPaths.length} seed(s) at level ${options.resumeLevel} from ${dir}`,
    );
    return buildResumeScenarios(options, seedPaths, seedsDir);
  }

  return buildFreshScenarios(options, seedsDir);
}

type RunOutcome = { results: SimResult[]; failedScenarios: number };

// Shared between the serial and parallel paths: writes a scenario's outcome
// through the one `RunLogger` this process owns, and reports if it crashed.
function recordOutcome(
  scenario: ScenarioConfig,
  outcome: ScenarioOutcome,
  logger: RunLogger,
  results: SimResult[],
): boolean {
  outcome.stonewalls.forEach(({ event, stateSnapshot }) =>
    logger.logStonewall(scenario, event, stateSnapshot),
  );
  outcome.runtimeErrors.forEach((e) =>
    logger.logRuntimeError(
      scenario,
      e.kind,
      e.message,
      e.stack,
      e.stateSnapshot,
    ),
  );

  if (outcome.crashed) {
    console.error(
      `Scenario crashed: ${scenario.comp.label} (${scenario.strategy}, trial ${scenario.trial}) - see runtime-errors.jsonl. Continuing.`,
    );
    return true;
  }

  if (outcome.result) results.push(outcome.result);
  return false;
}

async function runSerial(
  scenarios: ScenarioConfig[],
  logger: RunLogger,
  verbose: boolean,
): Promise<RunOutcome> {
  const results: SimResult[] = [];
  let failedScenarios = 0;

  for (const scenario of scenarios) {
    const outcome = await executeScenario(scenario, verbose);
    if (recordOutcome(scenario, outcome, logger, results)) failedScenarios += 1;
  }

  return { results, failedScenarios };
}

const WORKER_ENTRY = path.join(__dirname, 'worker.ts');
// `tsconfig.scripts.json`'s `"ts-node": { "files": true }` (whole-program
// mode) hits a `TS5011` rootDir error when forked directly into a single
// file; this override sets `files: false` to avoid it.
const TS_NODE_PROJECT = path.resolve(
  __dirname,
  '../../tsconfig.scripts.worker.json',
);

// Game state lives in module-level singletons, so scenarios can only run
// concurrently in separate processes. Each worker pulls scenarios off
// `queue` as it finishes the last one (work-stealing), and a worker dying
// doesn't abort the run - only its in-flight scenario is lost; the rest of
// `queue` keeps draining through the surviving workers.
function runParallel(
  scenarios: ScenarioConfig[],
  workerCount: number,
  logger: RunLogger,
  verbose: boolean,
): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const queue = [...scenarios];
    const results: SimResult[] = [];
    let failedScenarios = 0;
    let settledWorkers = 0;

    const workers: ChildProcess[] = [];
    const inFlight = new Map<ChildProcess, ScenarioConfig | undefined>();
    const alreadySettled = new Set<ChildProcess>();

    const dispatchNext = (worker: ChildProcess) => {
      const scenario = queue.shift();
      inFlight.set(worker, scenario);
      const request: WorkerRequest = scenario
        ? { type: 'run', scenario }
        : { type: 'shutdown' };
      worker.send(request);
    };

    // Anything left in `queue` once every worker has settled never ran.
    const finishRun = () => {
      queue.splice(0).forEach((scenario) => {
        failedScenarios += 1;
        logger.logRuntimeError(
          scenario,
          'Exception',
          'Never ran - the worker pool had no workers left to dispatch it to.',
        );
      });
      resolve({ results, failedScenarios });
    };

    // Shared by `error`/`exit` - `alreadySettled` guards against double-firing.
    const handleWorkerGone = (worker: ChildProcess, cause: string | null) => {
      if (alreadySettled.has(worker)) return;
      alreadySettled.add(worker);
      settledWorkers += 1;

      const lost = inFlight.get(worker);
      if (cause) {
        console.error(
          `Simulation worker ${cause} - continuing with remaining workers.`,
        );
      }
      if (lost) {
        failedScenarios += 1;
        logger.logRuntimeError(
          lost,
          'Exception',
          `Never finished - ${cause ?? 'its worker process exited'} while running this scenario.`,
        );
        console.error(
          `Scenario crashed (worker lost): ${lost.comp.label} (${lost.strategy}, trial ${lost.trial}) - see runtime-errors.jsonl.`,
        );
      }

      if (settledWorkers === workerCount) finishRun();
    };

    for (let i = 0; i < workerCount; i++) {
      const worker = fork(WORKER_ENTRY, [], {
        execArgv: [
          '--require',
          'ts-node/register',
          '--require',
          'tsconfig-paths/register',
        ],
        env: {
          ...process.env,
          TS_NODE_PROJECT,
          TS_NODE_TRANSPILE_ONLY: 'true',
          SIM_VERBOSE: verbose ? '1' : '0',
        },
      });
      workers.push(worker);

      worker.on('message', (message: WorkerResponse) => {
        if (message.type === 'ready') {
          dispatchNext(worker);
          return;
        }

        inFlight.set(worker, undefined);
        if (recordOutcome(message.scenario, message, logger, results)) {
          failedScenarios += 1;
        }
        dispatchNext(worker);
      });

      worker.on('error', (error) =>
        handleWorkerGone(worker, `${i} errored: ${error.message}`),
      );

      worker.on('exit', (code) => {
        // A clean shutdown (code 0) also lands here; `handleWorkerGone`
        // only logs when a scenario was actually in flight.
        handleWorkerGone(
          worker,
          code !== 0 && code !== null
            ? `${i} exited unexpectedly with code ${code}`
            : null,
        );
      });
    }
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.verbose) silenceDebugLogging();

  console.log(`Bootstrapping content...`);
  bootstrapContent();

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const logger = createRunLogger(runId, options.verbose);
  const seedsDir = options.dumpSeeds ? seedsDirFor(logger.logDir) : undefined;

  const scenarios = buildScenarios(options, seedsDir);

  const workerCount = Math.max(1, Math.min(options.workers, scenarios.length));

  console.log(
    `Running ${scenarios.length} scenario(s), tick budget ${options.tickBudget} each, ` +
      `across ${workerCount} worker(s)...` +
      (seedsDir ? ` Dumping seed checkpoints to ${seedsDir}.` : ''),
  );

  const { results, failedScenarios } =
    workerCount === 1
      ? await runSerial(scenarios, logger, options.verbose)
      : await runParallel(scenarios, workerCount, logger, options.verbose);

  if (failedScenarios > 0) {
    console.log(
      `\n${failedScenarios} scenario(s) crashed - see runtime-errors.jsonl.`,
    );
  }

  const summaries = summarizeResults(results);
  printSummaryTable(summaries);
  writeSummaryFiles(logger.logDir, summaries, options.verbose);

  const leaderboard = buildLeaderboard(results);
  printLeaderboard(leaderboard);
  writeLeaderboardFiles(logger.logDir, leaderboard, options.verbose);

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

// A fire-and-forget `updateGamestate` rejecting elsewhere would otherwise
// crash this process (Node treats unhandled rejections as fatal). Only
// matters for `--workers=1`; worker.ts has its own copy for its process.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection (continuing):', reason);
});

// Explicit exit - `helpers/ui.ts`'s `uiClockTick` interval has no `.unref()`,
// so the event loop would otherwise hang after `main()` finishes.
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

import type { GameState } from '@interfaces';
import fs from 'fs-extra';
import path from 'path';
import { TICKS_PER_HOUR } from './constants';
import type { ScenarioConfig, StonewallEvent } from './types';

export type ErrorLogEntry = {
  scenarioLabel: string;
  strategy: string;
  trial: number;
  kind: StonewallEvent['kind'];
  tick: number;
  simulatedHours: number;
  detail: string;
  dumpFile: string;
};

// `Exception` is a thrown error that aborted the scenario; `ConsoleError`/
// `ConsoleWarn` are captured calls to the game's own `error()`/`warn()`
// logging (`@helpers/logging`) during the scenario, which otherwise print
// straight to the terminal with no scenario/tick context and no record.
export type RuntimeErrorKind = 'Exception' | 'ConsoleError' | 'ConsoleWarn';

export type RuntimeErrorLogEntry = {
  scenarioLabel: string;
  strategy: string;
  trial: number;
  kind: RuntimeErrorKind;
  message: string;
  stack?: string;
  dumpFile?: string;
};

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '_');
}

function scenarioLabel(scenario: ScenarioConfig): string {
  return `${scenario.comp.label}__${scenario.strategy}__trial${scenario.trial}`;
}

export type RunLogger = {
  logDir: string;
  logStonewall(
    scenario: ScenarioConfig,
    event: StonewallEvent,
    stateSnapshot: GameState,
  ): void;
  logRuntimeError(
    scenario: ScenarioConfig,
    kind: RuntimeErrorKind,
    message: string,
    stack?: string,
    stateSnapshot?: GameState,
  ): void;
};

// Creates `<root>/simulation-logs/<runId>/` with `errors.jsonl` (one JSON
// line per stonewall/error, tick-stamped), `runtime-errors.jsonl` (thrown
// exceptions and captured console.error/warn output, scenario-tagged), and
// `dumps/` (a full GameState dump alongside every logged event, for
// debugging). Gitignored - see `.gitignore`.
export function createRunLogger(runId: string): RunLogger {
  const logDir = path.resolve(__dirname, '../../simulation-logs', runId);
  const dumpsDir = path.join(logDir, 'dumps');
  fs.ensureDirSync(dumpsDir);

  const errorsPath = path.join(logDir, 'errors.jsonl');
  const runtimeErrorsPath = path.join(logDir, 'runtime-errors.jsonl');
  let runtimeErrorCount = 0;

  return {
    logDir,
    logStonewall(scenario, event, stateSnapshot) {
      const label = sanitizeForFilename(scenarioLabel(scenario));
      const dumpFileName = `${label}-tick${event.tick}.json`;
      fs.writeJsonSync(path.join(dumpsDir, dumpFileName), stateSnapshot);

      const entry: ErrorLogEntry = {
        scenarioLabel: scenario.comp.label,
        strategy: scenario.strategy,
        trial: scenario.trial,
        kind: event.kind,
        tick: event.tick,
        simulatedHours: Math.round((event.tick / TICKS_PER_HOUR) * 100) / 100,
        detail: event.detail,
        dumpFile: path.join('dumps', dumpFileName),
      };

      fs.appendFileSync(errorsPath, JSON.stringify(entry) + '\n');
    },
    logRuntimeError(scenario, kind, message, stack, stateSnapshot) {
      runtimeErrorCount += 1;
      const label = sanitizeForFilename(scenarioLabel(scenario));

      let dumpFile: string | undefined;
      if (stateSnapshot) {
        const dumpFileName = `${label}-runtimeerror${runtimeErrorCount}.json`;
        fs.writeJsonSync(path.join(dumpsDir, dumpFileName), stateSnapshot);
        dumpFile = path.join('dumps', dumpFileName);
      }

      const entry: RuntimeErrorLogEntry = {
        scenarioLabel: scenario.comp.label,
        strategy: scenario.strategy,
        trial: scenario.trial,
        kind,
        message,
        stack,
        dumpFile,
      };

      fs.appendFileSync(runtimeErrorsPath, JSON.stringify(entry) + '\n');
    },
  };
}

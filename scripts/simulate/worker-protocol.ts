// IPC message shapes between run.ts (coordinator) and worker.ts.
import type { GameState } from '@interfaces';
import type { RuntimeErrorKind } from './logger';
import type { ScenarioConfig, SimResult, StonewallEvent } from './types';

export type LoggedStonewall = {
  event: StonewallEvent;
  stateSnapshot: GameState;
};

export type LoggedRuntimeError = {
  kind: RuntimeErrorKind;
  message: string;
  stack?: string;
  stateSnapshot?: GameState;
};

export type WorkerRequest =
  | { type: 'run'; scenario: ScenarioConfig }
  | { type: 'shutdown' };

// `done` batches a scenario's stonewalls/errors - only run.ts writes the log
// files, avoiding concurrent-append corruption across workers.
export type WorkerResponse =
  | { type: 'ready' }
  | {
      type: 'done';
      scenario: ScenarioConfig;
      result?: SimResult;
      crashed: boolean;
      stonewalls: LoggedStonewall[];
      runtimeErrors: LoggedRuntimeError[];
    };

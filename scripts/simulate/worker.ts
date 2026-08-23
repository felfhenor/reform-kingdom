// One pool slot's entry point - forked by run.ts, pulls scenarios off the
// coordinator's queue over IPC until told to shut down.
// Must be the first import - installs shims before any `@helpers` import.
import { settle, silenceDebugLogging } from './shims';

import { bootstrapContent } from './bootstrap';
import { executeScenario } from './scenario-runner';
import type { WorkerRequest, WorkerResponse } from './worker-protocol';

const verbose = process.env['SIM_VERBOSE'] === '1';
if (!verbose) silenceDebugLogging();

// A fire-and-forget `updateGamestate` call rejecting elsewhere in the game's
// helper code would otherwise crash this worker - Node treats an unhandled
// rejection as fatal by default.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection (continuing):', reason);
});

function send(message: WorkerResponse): void {
  process.send?.(message);
}

async function handleRequest(message: WorkerRequest): Promise<void> {
  if (message.type === 'shutdown') {
    process.exit(0);
  }

  const scenario = message.scenario;
  const outcome = await executeScenario(scenario, verbose);
  // Lets a trailing write land before the next scenario's `gameReset()`.
  await settle();

  send({
    type: 'done',
    scenario,
    result: outcome.result,
    crashed: outcome.crashed,
    stonewalls: outcome.stonewalls,
    runtimeErrors: outcome.runtimeErrors,
  });
}

process.on('message', (message: WorkerRequest) => {
  void handleRequest(message);
});

console.log(`Bootstrapping content...`);
bootstrapContent();
send({ type: 'ready' });

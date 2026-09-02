// Dumps/loads a full `GameState` snapshot so a scenario can resume from a
// past checkpoint instead of replaying every level from scratch.
import { formatGameStateForSave } from '@helpers/state-game';
import type { GameState } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import fs from 'fs-extra';
import path from 'path';
import { sanitizeForFilename, scenarioLabel } from './logger';
import type { ScenarioConfig } from './types';

const SIMULATION_LOGS_ROOT = path.resolve(__dirname, '../../simulation-logs');

export function seedsDirFor(logDir: string): string {
  return path.join(logDir, 'seeds');
}

function seedFilePath(
  seedsDir: string,
  scenario: ScenarioConfig,
  level: number,
): string {
  const label = sanitizeForFilename(scenarioLabel(scenario));
  return path.join(seedsDir, `${label}__L${level}.json`);
}

export function writeSeed(
  seedsDir: string,
  scenario: ScenarioConfig,
  level: number,
  state: GameState,
): void {
  fs.ensureDirSync(seedsDir);
  fs.writeJsonSync(seedFilePath(seedsDir, scenario, level), formatGameStateForSave(state));
}

export function loadSeed(seedPath: string): GameState {
  return fs.readJsonSync(seedPath) as GameState;
}

// Most recently modified `simulation-logs/*/seeds/` dir - lets
// `--resume-level` default to "whatever I just dumped" without also having
// to pass `--resume-seeds-dir`.
export function findLatestSeedsDir(): string | undefined {
  if (!fs.existsSync(SIMULATION_LOGS_ROOT)) return undefined;

  const candidates = fs
    .readdirSync(SIMULATION_LOGS_ROOT)
    .map((runId) => path.join(SIMULATION_LOGS_ROOT, runId, 'seeds'))
    .filter((dir) => fs.existsSync(dir))
    .map((dir) => ({ dir, mtime: fs.statSync(dir).mtimeMs }));

  if (candidates.length === 0) return undefined;

  return sortBy(candidates, [(c) => -c.mtime])[0].dir;
}

// Accepts either a bare runId (matches `simulation-logs/<runId>/seeds`) or a
// path (relative or absolute) straight to a seeds directory.
export function resolveSeedsDir(resumeSeedsDir: string | undefined): string {
  if (resumeSeedsDir === undefined) {
    const latest = findLatestSeedsDir();
    if (!latest) {
      throw new Error(
        'No simulation-logs/*/seeds directory found - run with --dump-seeds first, or pass --resume-seeds-dir explicitly.',
      );
    }
    return latest;
  }

  const asRunId = path.join(SIMULATION_LOGS_ROOT, resumeSeedsDir, 'seeds');
  if (fs.existsSync(asRunId)) return asRunId;

  const asPath = path.resolve(resumeSeedsDir);
  if (fs.existsSync(asPath)) return asPath;

  throw new Error(`Could not find a seeds directory for "${resumeSeedsDir}"`);
}

export function findSeedsAtLevel(seedsDir: string, level: number): string[] {
  return fs
    .readdirSync(seedsDir)
    .filter((file) => file.endsWith(`__L${level}.json`))
    .map((file) => path.join(seedsDir, file));
}

import { townReputationBuffSync } from '@helpers/town/reputation/town-reputation-buff';

// Re-derives every town's buff from scratch against `currentMapName` - used on game load,
// where the normal sync hook never runs.
export function townReputationBuffReconcile(currentMapName: string): void {
  townReputationBuffSync('', currentMapName);
}

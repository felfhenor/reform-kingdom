import { townReputationBuffRefresh } from '@helpers/town/reputation/town-reputation-buff';

// Used on game load, where the normal sync hook never runs.
export function townReputationBuffReconcile(currentMapName: string): void {
  townReputationBuffRefresh(currentMapName);
}

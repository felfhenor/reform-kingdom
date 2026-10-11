import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { regaliaNameClean } from '@helpers/hero/regalia';
import {
  stateRegaliaCreate,
  stateRegaliaEquip,
  stateRegaliaRemove,
  stateRegaliaUpdate,
} from '@helpers/hero/regalia-state';
import { canModifyEquipment } from '@helpers/item/equipment';
import { rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import type {
  CharacterId,
  GameState,
  JobContent,
  JobId,
  RegaliaId,
} from '@interfaces';

function sendRegaliaAnalytics(action: string, jobId?: JobId): void {
  const jobName = jobId ? getEntry<JobContent>(jobId)?.name : undefined;
  analyticsSendDesignEvent(`Hero:Regalia:${action}`);
  if (jobName) {
    analyticsSendDesignEvent(
      `Hero:Regalia:${action}:${analyticsSafeSegment(jobName)}`,
    );
  }
}

async function regaliaApply(
  action: string,
  mutate: (state: GameState) => JobId | undefined,
): Promise<JobId | undefined> {
  let jobId: JobId | undefined;
  await updateGamestate((state) => {
    jobId = mutate(state);
    return state;
  });

  if (jobId) sendRegaliaAnalytics(action, jobId);
  return jobId;
}

export async function regaliaCreate(
  characterId: CharacterId,
): Promise<RegaliaId | undefined> {
  const id = rngUuid() as RegaliaId;
  const jobId = await regaliaApply('Create', (state) =>
    stateRegaliaCreate(state, characterId, id),
  );
  return jobId ? id : undefined;
}

export async function regaliaEquip(
  characterId: CharacterId,
  regaliaId: RegaliaId,
): Promise<void> {
  if (!canModifyEquipment()) return;

  await regaliaApply('Equip', (state) =>
    stateRegaliaEquip(state, characterId, regaliaId),
  );
}

export async function regaliaUpdate(characterId: CharacterId): Promise<void> {
  await regaliaApply('Update', (state) =>
    stateRegaliaUpdate(state, characterId),
  );
}

export async function regaliaRemove(regaliaId: RegaliaId): Promise<void> {
  await regaliaApply('Remove', (state) => stateRegaliaRemove(state, regaliaId));
}

export async function regaliaRename(
  regaliaId: RegaliaId,
  name: string,
): Promise<void> {
  await updateGamestate((state) => {
    const regalia = state.regalias.entries.find((r) => r.id === regaliaId);
    if (regalia) regalia.name = regaliaNameClean(name, regalia.name);
    return state;
  });

  sendRegaliaAnalytics('Rename');
}

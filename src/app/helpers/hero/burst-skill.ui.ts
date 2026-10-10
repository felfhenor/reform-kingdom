import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { updateGamestate } from '@helpers/state-game';
import type {
  CharacterId,
  EquipmentSkillContent,
  EquipmentSkillId,
  JobId,
} from '@interfaces';

function setBurstSkills(
  characterId: CharacterId,
  jobId: JobId,
  skillIds: EquipmentSkillId[],
): void {
  updateGamestate((state) => {
    const character = state.world.party.find((c) => c.id === characterId);
    if (!character) return state;

    character.burstSkills ??= {};
    character.burstSkills[jobId] = skillIds;
    return state;
  });
}

export function burstSkillSet(
  characterId: CharacterId,
  jobId: JobId,
  skill: EquipmentSkillContent,
): void {
  setBurstSkills(characterId, jobId, [skill.id]);
  analyticsSendDesignEvent(
    `Hero:BurstSkill:Set:${analyticsSafeSegment(skill.name)}`,
  );
}

export function burstSkillUnset(characterId: CharacterId, jobId: JobId): void {
  setBurstSkills(characterId, jobId, []);
  analyticsSendDesignEvent('Hero:BurstSkill:Unset');
}

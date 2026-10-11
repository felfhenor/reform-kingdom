import type { CharacterId } from '@interfaces/character';
import type { CombatOrderClause } from '@interfaces/combat-order';
import type { JobId } from '@interfaces/content-job';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { EquipmentItem, EquipmentItemId } from '@interfaces/equipment';
import type { Branded } from '@interfaces/identifiable';

export type RegaliaId = Branded<string, 'RegaliaId'>;

// A snapshot of one hero's loadout for one job; gear is referenced by instance id, so several regalias can share an item.
export type Regalia = {
  id: RegaliaId;
  name: string;
  characterId: CharacterId;
  jobId: JobId;
  equipmentItemIds: EquipmentItemId[];
  combatOrders: CombatOrderClause[];
  burstSkillIds: EquipmentSkillId[];
};

// `vault` holds regalia gear that is neither equipped nor in the armory.
export type GameStateRegalias = {
  entries: Regalia[];
  vault: EquipmentItem[];
};

export type RegaliaMissingReason = 'gone' | 'unequippable' | 'displaced';

export type RegaliaMissingItem = {
  id: EquipmentItemId;
  reason: RegaliaMissingReason;
};

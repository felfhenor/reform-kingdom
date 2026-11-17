import type { CharacterId } from '@interfaces/character';
import type { CombatOrderClause } from '@interfaces/combat-order';
import type {
  EncounterContent,
  EncounterId,
} from '@interfaces/content-encounter';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { JobId } from '@interfaces/content-job';
import type { SkillTreeNodeId } from '@interfaces/content-skilltreenode';
import type { DifficultyTier } from '@interfaces/difficulty-tier';
import type { EquipmentItemId, EquipmentSlot } from '@interfaces/equipment';
import type { HasNodeBackground } from '@interfaces/node-background';
import type { HeroRunStats } from '@interfaces/run-stats';
import type { WorldNodeEntry } from '@interfaces/world-nodes';

// Only what the player changed; anything unset reads from the real hero.
export type ColosseumHeroEdit = {
  characterId: CharacterId;
  jobId?: JobId;
  // null empties a slot the real hero has filled.
  equipment?: Partial<Record<EquipmentSlot, ColosseumGearPick | null>>;
  skillTreeNodes?: SkillTreeNodeId[];
  combatOrders?: CombatOrderClause[];
  burstSkillIds?: EquipmentSkillId[];
};

// Keeps the equipment id so a pick that's since been sold can still be named.
export type ColosseumGearPick = {
  itemId: EquipmentItemId;
  equipmentId: EquipmentId;
};

export type ColosseumSetup = {
  encounterId?: EncounterId;
  // Unset runs the whole encounter.
  fightIndex?: number;
  heroes: ColosseumHeroEdit[];
};

export type ColosseumSetupPruneReport = {
  setup: ColosseumSetup;
  dropped: string[];
};

export type ColosseumEncounterOption = {
  encounter: EncounterContent;
  node?: WorldNodeEntry;
  tier: DifficultyTier;
};

export type ColosseumEncounterRow = ColosseumEncounterOption & {
  background?: HasNodeBackground;
};

export type ColosseumFightOutcome = 'Won' | 'Lost' | 'Stalemate';

export type ColosseumHeroStats = Partial<Record<CharacterId, HeroRunStats>>;

export type ColosseumRunResult = {
  outcome: ColosseumFightOutcome;
  rounds: number;
  // The fight the run ended on.
  fightIndex: number;
  heroes: ColosseumHeroStats;
};

export type ColosseumHeroAverages = {
  characterId: CharacterId;
  damageDealt: number;
  healing: number;
  kills: number;
  deaths: number;
};

export type ColosseumBatchSummary = {
  runs: number;
  wins: number;
  stalemates: number;
  winRate: number;
  averageRounds: number;
  averageHeroDeaths: number;
  // Index = fight index; counts runs lost (or stalled) on that fight.
  lossesByFight: number[];
  heroes: ColosseumHeroAverages[];
};

export type ColosseumHeroTab =
  'overview' | 'job' | 'gear' | 'tree' | 'orders' | 'burst';

export type ColosseumFightMode = 'auto' | 'manual';

import type { HasSprite } from '@interfaces/artable';
import type { CollectibleId } from '@interfaces/content-collectible';
import type { EdictId, EdictKind } from '@interfaces/content-edict';
import type { JobId } from '@interfaces/content-job';
import type { MonsterId } from '@interfaces/content-monster';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type AchievementId = Branded<string, 'AchievementId'>;

export const ACHIEVEMENT_COUNTERS = [
  'PartyLevel',
  'RegionsVisited',
  'RegionsSealed',
  'WorkersRescued',
  'TownsHonored',
  'TownsRenowned',
  'MonstersAnalyzed',
  'MysticalFound',
  'ShrinesMaxed',
  'OutpostsBuilt',
  'TradeskillLevel',
  'TasksCompleted',
  'Remembrance',
  'JobsMastered',
] as const;

export type AchievementCounter = (typeof ACHIEVEMENT_COUNTERS)[number];

export const ACHIEVEMENT_MOMENTS = [
  'CaravanTrade',
  'ShrineMemoriamPrayer',
] as const;

export type AchievementMoment = (typeof ACHIEVEMENT_MOMENTS)[number];

export type AchievementHeroFeat = 'OneTrick' | 'PacifistHealer';

// Every set field must hold for a run to count.
export type AchievementRunFilter = {
  minEdicts?: number;
  minNonBoonEdicts?: number;
  minFragments?: number;
  edictIds?: EdictId[];
  excludedEdictIds?: EdictId[];
  minPartySize?: number;
  sameJob?: boolean;
  heroFeat?: AchievementHeroFeat;
  maxFelTick?: number;
  noBoons?: boolean;
  noDeaths?: boolean;
  noReclass?: boolean;
  // No hero may ever have served in these jobs during the run.
  excludedJobIds?: JobId[];
};

// A Reach without a target means the counter's maximum, so "all of them" follows the content.
export type AchievementConditionReach = {
  type: 'Reach';
  counter: AchievementCounter;
  target?: number;
};

export type AchievementConditionDefeat = {
  type: 'Defeat';
  monsterIds: MonsterId[];
};

export type AchievementConditionCollect = {
  type: 'Collect';
  collectibleIds: CollectibleId[];
};

export type AchievementConditionCompleteRun = AchievementRunFilter & {
  type: 'CompleteRun';
  count?: number;
};

// Every edict of the kind, each held in any Completed run.
export type AchievementConditionClearEdicts = {
  type: 'ClearEdicts';
  kind: EdictKind;
};

// Caught as it happens, so there's nothing in the save to catch up from.
export type AchievementConditionMoment = {
  type: 'Moment';
  moment: AchievementMoment;
};

export type AchievementCondition =
  | AchievementConditionReach
  | AchievementConditionDefeat
  | AchievementConditionCollect
  | AchievementConditionCompleteRun
  | AchievementConditionClearEdicts
  | AchievementConditionMoment;

export type AchievementContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: AchievementId;
    __type: 'achievement';

    hidden: boolean;
    // For a count that reads as a yes/no milestone, where a bar would only show 1/2.
    hideProgress?: boolean;
    condition: AchievementCondition;
  };

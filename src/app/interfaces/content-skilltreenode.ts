import type {
  AffixEffectCombatStat,
  AffixEffectElementalBoon,
  AffixEffectElementalResistance,
  AffixEffectGrantSkill,
  AffixEffectResistance,
  AffixEffectStat,
} from '@interfaces/content-affix';
import type { JobId } from '@interfaces/content-job';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type {
  HeroEffectDebuffPotency,
  HeroEffectJobAbility,
  HeroEffectSkillModifier,
  HeroEffectStatPerLevel,
} from '@interfaces/hero-effect';
import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type SkillTreeNodeId = Branded<string, 'SkillTreeNodeId'>;

// Every lane and spec row across all jobs; which job owns which row is checked by validate:skilltrees.
export type SkillTreeRow =
  | 'Abilities'
  | 'Weapon Arts'
  | 'Shield Arts'
  | 'Swashbuckler'
  | 'Bastion'
  | 'Marksmanship'
  | 'Nature'
  | 'Stalker'
  | 'Wayfinder'
  | 'Fieldcraft'
  | 'Fortune'
  | 'Treasure Hunter'
  | 'Dungeon Delver'
  | 'Evocation'
  | 'Spellweaving'
  | 'Arcanist'
  | 'Celestar'
  | 'Restoration'
  | 'Divine Might'
  | 'Lifegiver'
  | 'Templar';

export type SkillTreeNodeEffect =
  | AffixEffectStat
  | AffixEffectCombatStat
  | AffixEffectResistance
  | AffixEffectElementalResistance
  | AffixEffectElementalBoon
  | AffixEffectGrantSkill
  | HeroEffectJobAbility
  | HeroEffectStatPerLevel
  | HeroEffectDebuffPotency
  | HeroEffectSkillModifier;

export const SkillTreeNodeEffectKinds: SkillTreeNodeEffect['kind'][] = [
  'Stat',
  'CombatStat',
  'Resistance',
  'ElementalResistance',
  'ElementalBoon',
  'GrantSkill',
  'JobAbility',
  'StatPerLevel',
  'DebuffPotency',
  'SkillModifier',
];

// Names are '<Job>: <Name>' to stay globally unique; an oath lists two options and carries no effects itself.
// Only nodes with art of their own (spec options) set a sprite; others borrow their skill's, ability's or job's.
export type SkillTreeNodeContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: SkillTreeNodeId;
    __type: 'skilltreenode';

    jobId: JobId;
    // The node's column and level requirement: 1 or a multiple of 5. Oath options have none.
    level: number;
    // Empty for oath options.
    row: SkillTreeRow | '';
    track: number;

    requiredSkillTreeNodeIds: SkillTreeNodeId[];
    optionSkillTreeNodeIds: SkillTreeNodeId[];

    // Pre-allocated on new heroes; still costs SP.
    default: boolean;

    effects: SkillTreeNodeEffect[];
  };

// A skill a job's tree can grant, at the column level its node unlocks.
export type SkillTreeSkillGrant = {
  skillId: EquipmentSkillId;
  level: number;
  isDefault: boolean;
};

// learned = confirmed; pending = staged, not confirmed; excluded = locked out by an oath pick.
export type SkillTreeNodeState =
  'learned' | 'pending' | 'available' | 'locked' | 'excluded';

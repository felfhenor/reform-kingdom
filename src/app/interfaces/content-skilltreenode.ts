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
  HeroEffectStatPerLevel,
} from '@interfaces/hero-effect';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type SkillTreeNodeId = Branded<string, 'SkillTreeNodeId'>;

// Every lane and spec row across all jobs; which job owns which row is checked by validate:skilltrees.
export type SkillTreeRow =
  | 'Abilities'
  | 'Weapon Arts'
  | 'Shield Arts'
  | 'Swashbuckler'
  | 'Defender'
  | 'Marksmanship'
  | 'Bombardment'
  | 'Nature'
  | 'Stalker'
  | 'Wayfinder'
  | 'Fieldcraft'
  | 'Fortune'
  | 'Treasure Hunter'
  | 'Dungeon Delver'
  | 'Fire Magic'
  | 'Storm Magic'
  | 'Spellweaving'
  | 'Arcanist'
  | 'Spellweaver'
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
  | HeroEffectDebuffPotency;

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
];

// Names are '<Job>: <Name>' to stay globally unique; an oath lists two options and carries no effects itself.
export type SkillTreeNodeContent = IsContentItem &
  HasDescription & {
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

    // Marks a spec oath option; a game-icons name for the job label.
    specIcon: string;

    effects: SkillTreeNodeEffect[];
  };

// A skill a job's tree can grant, at the column level its node unlocks.
export type SkillTreeSkillGrant = {
  skillId: EquipmentSkillId;
  level: number;
  isDefault: boolean;
};

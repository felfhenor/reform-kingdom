import type { HasAnimation } from '@interfaces/artable';
import type { CombatOrderClause } from '@interfaces/combat-order';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { SkillTreeRow } from '@interfaces/content-skilltreenode';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { BaseStat, StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type JobId = Branded<string, 'JobId'>;

// A new hero's starting Combat Orders; the id and enabled flag are assigned when the hero is created.
export type JobDefaultCombatOrder = Pick<
  CombatOrderClause,
  'condition' | 'action'
>;

export type JobStatPriority = {
  stat: BaseStat;
  multiplier: number;
};

export type JobContent = IsContentItem &
  HasDescription &
  HasAnimation & {
    id: JobId;

    shorthand: string;

    baseStats: StatBlock;
    statsPerLevel: StatBlock;

    equippableTypes: EquipmentItemType[];

    // Stats "Optimize Equipment" favors, highest priority first; ties fall back to level requirement.
    statPriority: JobStatPriority[];

    // Bumping it resets every hero's tree for this job on next load.
    treeVersion: number;
    // Lanes top to bottom; field names avoid content-folder words the gamedata id rewrite would match.
    treeRows: SkillTreeRow[];
    // Drawn under the divider; must match the spec oath option names.
    specializationRows: SkillTreeRow[];

    defaultCombatOrders: JobDefaultCombatOrder[];

    // Only given on new-game hero creation, never on reclass.
    starterEquipmentIds: EquipmentId[];
  };

import type { AtlasedImage } from '@interfaces/artable';
import type { EquipmentSkillContent } from '@interfaces/content-skill';
import type {
  SkillTreeNodeContent,
  SkillTreeNodeId,
  SkillTreeNodeState,
  SkillTreeRow,
} from '@interfaces/content-skilltreenode';
import type { GameElement } from '@interfaces/element';
import type { StatusEffectPreview } from '@interfaces/statuseffect-preview.ui';

// A measured rectangle in tree pixels: a node, or an oath frame standing in for its oath.
export type SkillTreeLayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SkillTreeLayoutLevel = { level: number; gridRow: number };

// One node, or an oath's options framed together; laneRow counts from the lane's first level row.
export type SkillTreeLayoutItem = {
  node: SkillTreeNodeContent;
  laneRow: number;
  track: number;
  options: SkillTreeNodeContent[];
};

export type SkillTreeLayoutLane = {
  row: SkillTreeRow;
  gridColumn: number;
  isSpec: boolean;
  trackColumns: string;
  items: SkillTreeLayoutItem[];
};

// A spec oath, framed across the spec columns with one option over each.
export type SkillTreeLayoutSpecOath = {
  node: SkillTreeNodeContent;
  gridRow: number;
  options: SkillTreeNodeContent[];
};

export type SkillTreeLayoutArrow = {
  fromId: SkillTreeNodeId;
  toId: SkillTreeNodeId;
  points: string;
};

export type SkillTreeLayout = {
  columns: string;
  rows: string;
  laneRows: string;
  lanePadding: number;
  levels: SkillTreeLayoutLevel[];
  lanes: SkillTreeLayoutLane[];
  dividerColumn: number;
  specColumns?: string;
  specOaths: SkillTreeLayoutSpecOath[];
  specOathInset: string;
};

// One label's skill modifiers; added elements are kept apart so they can show as badges.
// A run of text; a status or skill name carries its icon, drawn just before it.
export type SkillModifierLineSegment = {
  text: string;
  art?: SkillTreeNodeArt;
  statusEffect?: StatusEffectPreview;
  skill?: EquipmentSkillContent;
};

export type SkillModifierLineEntry = { segments: SkillModifierLineSegment[] };

// label is the oath option's name, or empty where the panel already shows the skill.
export type SkillModifierLine = {
  label: string;
  elements: GameElement[];
  entries: SkillModifierLineEntry[];
};

// The option picked for an oath, confirmed or only staged.
export type SkillTreeOathChoice = { name: string; state: SkillTreeNodeState };

export type SkillTreeNodeKind =
  | 'Skill'
  | 'Burst Skill'
  | 'Job Ability'
  | 'Skill Modifier'
  | 'Specialization'
  | 'Perk';

export type SkillTreeNodeArt = { sprite: string; spritesheet: AtlasedImage };

// A saved build as the Regalias page shows it.
export type SkillTreeNodeSummary = {
  node: SkillTreeNodeContent;
  name: string;
  art: SkillTreeNodeArt;
};

export type SkillTreeBuildSummary = {
  spec?: SkillTreeNodeSummary;
  spent: number;
  earned: number;
  nodes: SkillTreeNodeSummary[];
};

import type { AtlasedImage } from '@interfaces/artable';
import type {
  SkillTreeNodeContent,
  SkillTreeNodeId,
  SkillTreeRow,
} from '@interfaces/content-skilltreenode';

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
  levels: SkillTreeLayoutLevel[];
  lanes: SkillTreeLayoutLane[];
  dividerColumn: number;
  specColumns?: string;
  specOaths: SkillTreeLayoutSpecOath[];
  specOathInset: string;
};

export type SkillTreeNodeKind =
  'Skill' | 'Job Ability' | 'Specialization' | 'Perk';

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

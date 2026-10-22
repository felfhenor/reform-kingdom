import {
  SKILL_TREE_COLUMN_GAP,
  SKILL_TREE_COLUMN_INTERVAL,
  SKILL_TREE_GROUP_TITLE_HEIGHT,
  SKILL_TREE_LANE_TITLE_HEIGHT,
  SKILL_TREE_LEVEL_LABEL_WIDTH,
  SKILL_TREE_MAX_COLUMN_LEVEL,
  SKILL_TREE_MAX_TRACKS,
  SKILL_TREE_NODE_SIZE,
  SKILL_TREE_OATH_BORDER,
  SKILL_TREE_OATH_OPTION_GAP,
  SKILL_TREE_OATH_PADDING,
  SKILL_TREE_ROW_HEIGHT,
  SKILL_TREE_TRACK_MIN_WIDTH,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { jobAbilityValueLabel } from '@helpers/hero/job-ability.ui';
import { affixEffectsStatsPerLevel } from '@helpers/hero/party';
import { characterCurrentRegalia } from '@helpers/hero/regalia';
import { skillTreeNodeModifiers } from '@helpers/hero/skill-modifier';
import { skillModifierFamilySkill } from '@helpers/hero/skill-modifier.ui';
import {
  characterSkillTreeAvailableSp,
  characterSkillTreeNodeIds,
  characterSpecNode,
  skillTreeEarnedSp,
} from '@helpers/hero/skill-tree';
import {
  skillTreeIsOath,
  skillTreeIsSpecOption,
  skillTreeJobNodes,
  skillTreeNodeShortName,
  skillTreeOptionOath,
} from '@helpers/hero/skill-tree-content';
import { regaliasState } from '@helpers/state-game';
import type {
  Character,
  EquipmentSkillContent,
  JobAbilityContent,
  JobContent,
  SkillTreeBuildSummary,
  SkillTreeLayout,
  SkillTreeLayoutArrow,
  SkillTreeLayoutBox,
  SkillTreeLayoutItem,
  SkillTreeLayoutLane,
  SkillTreeLayoutLevel,
  SkillTreeLayoutSpecOath,
  SkillTreeNodeArt,
  SkillTreeNodeContent,
  SkillTreeNodeId,
  SkillTreeNodeKind,
  SkillTreeNodeSummary,
  SkillTreeRow,
  StatBlock,
} from '@interfaces';
import { max, range, sortBy } from 'es-toolkit/compat';

const HEADER_ROWS = 2;
const OATH_FRAME_WIDTH =
  SKILL_TREE_NODE_SIZE * 2 +
  SKILL_TREE_OATH_OPTION_GAP +
  (SKILL_TREE_OATH_PADDING + SKILL_TREE_OATH_BORDER) * 2;
// Room on each side of a lane for an oath framed on its edge track.
const LANE_PADDING = Math.max(
  0,
  (OATH_FRAME_WIDTH - SKILL_TREE_TRACK_MIN_WIDTH) / 2,
);
const LANE_MIN_WIDTH =
  SKILL_TREE_MAX_TRACKS * SKILL_TREE_TRACK_MIN_WIDTH + LANE_PADDING * 2;
const ARROW_BEND = (SKILL_TREE_ROW_HEIGHT - SKILL_TREE_NODE_SIZE) / 4;

function skillTreeLevels(): SkillTreeLayoutLevel[] {
  const levels = [
    1,
    ...range(
      SKILL_TREE_COLUMN_INTERVAL,
      SKILL_TREE_MAX_COLUMN_LEVEL + 1,
      SKILL_TREE_COLUMN_INTERVAL,
    ),
  ];
  return levels.map((level, i) => ({ level, gridRow: HEADER_ROWS + i + 1 }));
}

function laneColumns(count: number): string {
  return count > 0 ? `repeat(${count}, minmax(${LANE_MIN_WIDTH}px, 1fr))` : '';
}

// Level labels, base lanes, a zero-width divider, then spec lanes; the column gap spaces them all.
function skillTreeColumns(job: JobContent): string {
  return [
    `${SKILL_TREE_LEVEL_LABEL_WIDTH}px`,
    laneColumns(job.treeRows.length),
    '0px',
    laneColumns(job.specializationRows.length),
  ]
    .filter((column) => column !== '')
    .join(' ');
}

// A spec oath's options in spec column order, if every spec column has exactly one of them.
function specOathOptions(
  oath: SkillTreeNodeContent,
  nodes: SkillTreeNodeContent[],
  job: JobContent,
): SkillTreeNodeContent[] | undefined {
  const options = nodes.filter(
    (node) =>
      oath.optionSkillTreeNodeIds.includes(node.id) &&
      skillTreeIsSpecOption(node),
  );
  const ordered = job.specializationRows.flatMap((row) =>
    options.filter((option) => skillTreeNodeShortName(option) === row),
  );
  return ordered.length === oath.optionSkillTreeNodeIds.length &&
    ordered.length === job.specializationRows.length
    ? ordered
    : undefined;
}

function skillTreeSpecOaths(
  job: JobContent,
  nodes: SkillTreeNodeContent[],
  levels: SkillTreeLayoutLevel[],
): SkillTreeLayoutSpecOath[] {
  return nodes.filter(skillTreeIsOath).flatMap((node) => {
    const options = specOathOptions(node, nodes, job);
    const gridRow = levels.find((entry) => entry.level === node.level)?.gridRow;
    return options && gridRow ? [{ node, gridRow, options }] : [];
  });
}

// Pulls the spec oath frame in from the spec columns' outer edges to hug the option centred in each.
function specOathInset(columns: number): string {
  const half =
    SKILL_TREE_NODE_SIZE / 2 + SKILL_TREE_OATH_PADDING + SKILL_TREE_OATH_BORDER;
  const gapShare =
    (Math.max(columns - 1, 0) * SKILL_TREE_COLUMN_GAP) / (2 * columns);
  return `calc(${100 / (2 * columns)}% - ${gapShare + half}px)`;
}

function laneItem(
  node: SkillTreeNodeContent,
  nodes: SkillTreeNodeContent[],
  levels: SkillTreeLayoutLevel[],
): SkillTreeLayoutItem {
  return {
    node,
    laneRow: levels.findIndex((entry) => entry.level === node.level) + 1,
    track: node.track,
    options: nodes.filter((entry) =>
      node.optionSkillTreeNodeIds.includes(entry.id),
    ),
  };
}

function skillTreeLane(
  row: SkillTreeRow,
  gridColumn: number,
  isSpec: boolean,
  nodes: SkillTreeNodeContent[],
  levels: SkillTreeLayoutLevel[],
): SkillTreeLayoutLane {
  const laneNodes = nodes.filter((node) => node.row === row);
  const tracks = (max(laneNodes.map((node) => node.track)) ?? 0) + 1;
  return {
    row,
    gridColumn,
    isSpec,
    trackColumns: `repeat(${tracks}, minmax(${SKILL_TREE_TRACK_MIN_WIDTH}px, 1fr))`,
    items: laneNodes.map((node) => laneItem(node, nodes, levels)),
  };
}

// Grid placement of a job's tree: levels as rows, lanes as equal columns split into tracks.
export function skillTreeLayout(job: JobContent): SkillTreeLayout {
  const nodes = skillTreeJobNodes(job.id);
  const levels = skillTreeLevels();
  const specOaths = skillTreeSpecOaths(job, nodes, levels);
  const laneNodes = nodes.filter(
    (node) => !specOaths.some((oath) => oath.node.id === node.id),
  );
  const dividerColumn = job.treeRows.length + 2;
  const specCount = job.specializationRows.length;

  return {
    columns: skillTreeColumns(job),
    rows: `${SKILL_TREE_GROUP_TITLE_HEIGHT}px ${SKILL_TREE_LANE_TITLE_HEIGHT}px repeat(${levels.length}, ${SKILL_TREE_ROW_HEIGHT}px)`,
    laneRows: `repeat(${levels.length}, ${SKILL_TREE_ROW_HEIGHT}px)`,
    lanePadding: LANE_PADDING,
    levels,
    lanes: [
      ...job.treeRows.map((row, i) =>
        skillTreeLane(row, i + 2, false, laneNodes, levels),
      ),
      ...job.specializationRows.map((row, i) =>
        skillTreeLane(row, dividerColumn + 1 + i, true, laneNodes, levels),
      ),
    ],
    dividerColumn,
    specColumns:
      specCount > 0 ? `${dividerColumn + 1} / span ${specCount}` : undefined,
    specOaths,
    specOathInset: specOathInset(specCount),
  };
}

// Leaves the parent's bottom and turns in the gap below it, so branches never cross a node.
function arrowBetween(
  from: SkillTreeLayoutBox,
  to: SkillTreeLayoutBox,
): string {
  const start = { x: from.x + from.width / 2, y: from.y + from.height };
  const end = { x: to.x + to.width / 2, y: to.y };
  if (Math.abs(start.x - end.x) < 1) {
    return `${start.x},${start.y} ${start.x},${end.y}`;
  }

  const bendY = start.y + ARROW_BEND;
  return `${start.x},${start.y} ${start.x},${bendY} ${end.x},${bendY} ${end.x},${end.y}`;
}

// Boxes are measured from the rendered tree; an oath's frame box stands in for the oath.
export function skillTreeArrows(
  nodes: SkillTreeNodeContent[],
  boxes: Map<SkillTreeNodeId, SkillTreeLayoutBox>,
): SkillTreeLayoutArrow[] {
  return nodes.flatMap((node) => {
    const to = boxes.get(node.id);
    if (!to) return [];

    return node.requiredSkillTreeNodeIds.flatMap((fromId) => {
      const from = boxes.get(fromId);
      return from
        ? [{ fromId, toId: node.id, points: arrowBetween(from, to) }]
        : [];
    });
  });
}

export function skillTreeNodeSkill(
  node: SkillTreeNodeContent,
): EquipmentSkillContent | undefined {
  const effect = node.effects.find((entry) => entry.kind === 'GrantSkill');
  return effect?.kind === 'GrantSkill'
    ? getEntry<EquipmentSkillContent>(effect.skillId)
    : undefined;
}

function nodeAbility(
  node: SkillTreeNodeContent,
): JobAbilityContent | undefined {
  const effect = node.effects.find((entry) => entry.kind === 'JobAbility');
  return effect?.kind === 'JobAbility'
    ? getEntry<JobAbilityContent>(effect.jobAbilityId)
    : undefined;
}

export function skillTreeNodeKind(
  node: SkillTreeNodeContent,
): SkillTreeNodeKind {
  const skillData = skillTreeNodeSkill(node);
  if (skillData) {
    if (skillData.special) return 'Burst Skill';
    return 'Skill';
  }
  if (nodeAbility(node)) return 'Job Ability';
  if (skillTreeNodeModifiers(node).length > 0) return 'Skill Modifier';
  return skillTreeIsSpecOption(node) ? 'Specialization' : 'Perk';
}

// Skill and ability nodes reuse their content's art; perks show the job until they have their own.
export function skillTreeNodeArt(
  node: SkillTreeNodeContent,
  job: JobContent,
): SkillTreeNodeArt {
  const skill = skillTreeNodeSkill(node);
  if (skill) return { sprite: skill.sprite, spritesheet: 'skill' };

  // An oath has no art of its own; its first option's stands in (e.g. a required skill oath shows that skill).
  const firstOption = node.optionSkillTreeNodeIds[0];
  const option = firstOption
    ? getEntry<SkillTreeNodeContent>(firstOption)
    : undefined;
  if (option) return skillTreeNodeArt(option, job);

  const ability = nodeAbility(node);
  if (ability) return { sprite: ability.sprite, spritesheet: 'jobability' };

  if (node.sprite !== '') {
    return { sprite: node.sprite, spritesheet: 'skilltreenode' };
  }

  const [modifier] = skillTreeNodeModifiers(node);
  const modified = modifier
    ? skillModifierFamilySkill(modifier.family)
    : undefined;
  if (modified) return { sprite: modified.sprite, spritesheet: 'skill' };

  return { sprite: job.sprite, spritesheet: 'job' };
}

export function skillTreeNodeEffectText(node: SkillTreeNodeContent): string {
  return (
    node.description ||
    skillTreeNodeSkill(node)?.description ||
    nodeAbility(node)?.description ||
    ''
  );
}

// A job ability node's own rank value, e.g. "+10% item drop rate".
export function skillTreeNodeValueText(node: SkillTreeNodeContent): string {
  const ability = nodeAbility(node);
  const effect = node.effects.find((entry) => entry.kind === 'JobAbility');
  return ability && effect?.kind === 'JobAbility'
    ? jobAbilityValueLabel(ability, effect.value)
    : '';
}

export function skillTreeNodeStatsPerLevel(
  node: SkillTreeNodeContent,
): StatBlock | undefined {
  return node.effects.some((effect) => effect.kind === 'StatPerLevel')
    ? affixEffectsStatsPerLevel(node.effects)
    : undefined;
}

function skillTreeNodeSummary(
  node: SkillTreeNodeContent,
  job: JobContent,
): SkillTreeNodeSummary {
  return {
    node,
    name: skillTreeNodeShortName(node),
    art: skillTreeNodeArt(node, job),
  };
}

export function skillTreeNodeRequirements(
  node: SkillTreeNodeContent,
  job: JobContent,
): SkillTreeNodeSummary[] {
  const nodes = skillTreeJobNodes(node.jobId);
  const gate = skillTreeOptionOath(nodes, node.id) ?? node;
  return nodes
    .filter((entry) => gate.requiredSkillTreeNodeIds.includes(entry.id))
    .map((entry) => skillTreeNodeSummary(entry, job));
}

// What a Memory Flux reset will cost the hero, for its confirm prompt.
export function skillTreeResetPromptText(
  character: Character,
  job: JobContent,
  fluxOwned: number,
  format: (value: number) => string,
): string {
  const learned = characterSkillTreeNodeIds(character, job.id);
  const spec = characterSpecNode(character, job.id);
  const regalia = characterCurrentRegalia(regaliasState().entries, character);
  const refund =
    learned.length + characterSkillTreeAvailableSp(character, job.id);

  return [
    `${character.name} will forget every ${job.name} skill, ability and bonus they learned${spec ? `, including their ${skillTreeNodeShortName(spec)} specialization,` : ''} and get all ${format(refund)} SP back.`,
    regalia
      ? `Their regalia "${regalia.name}" is reset too; other regalias keep their builds.`
      : '',
    'Combat Orders that use a forgotten skill will be turned off.',
    `This uses 1 Memory Flux (you have ${format(fluxOwned)}).`,
  ]
    .filter((line) => line !== '')
    .join(' ');
}

export function skillTreeBuildSummary(
  nodeIds: SkillTreeNodeId[],
  job: JobContent,
  level: number,
): SkillTreeBuildSummary {
  const nodes = nodeIds
    .map((id) => getEntry<SkillTreeNodeContent>(id))
    .filter((node): node is SkillTreeNodeContent => !!node);
  const spec = nodes.find(skillTreeIsSpecOption);

  return {
    spec: spec ? skillTreeNodeSummary(spec, job) : undefined,
    spent: nodeIds.length,
    earned: skillTreeEarnedSp(level),
    nodes: sortBy(
      nodes.map((node) => skillTreeNodeSummary(node, job)),
      (entry) => entry.name,
    ),
  };
}

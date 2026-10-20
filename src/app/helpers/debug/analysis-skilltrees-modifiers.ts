import { getEntry } from '@helpers/content/content';
import { skillTreeGrantedSkills } from '@helpers/debug/analysis-skilltrees-ranks';
import { analysisFail, analysisWarn } from '@helpers/debug/analysis-utils';
import { skillTreeNodeModifiers } from '@helpers/hero/skill-modifier';
import { skillTreeOptionOath } from '@helpers/hero/skill-tree-content';
import type {
  AnalysisIssue,
  EquipmentSkillContent,
  HeroEffectSkillModifier,
  SkillTreeNodeContent,
  StatusEffectContent,
} from '@interfaces';

function referenceIssues(
  node: SkillTreeNodeContent,
  modifier: HeroEffectSkillModifier,
): AnalysisIssue[] {
  if (
    (modifier.modifier === 'Inflict' || modifier.modifier === 'Potency') &&
    getEntry<StatusEffectContent>(modifier.statusEffectId)?.__type !==
      'statuseffect'
  ) {
    return [
      analysisFail(
        `${node.name}: unknown status "${modifier.statusEffectId}".`,
      ),
    ];
  }
  if (
    modifier.modifier === 'Echo' &&
    getEntry<EquipmentSkillContent>(modifier.skillId)?.__type !== 'skill'
  ) {
    return [
      analysisFail(`${node.name}: echoes unknown skill "${modifier.skillId}".`),
    ];
  }
  return [];
}

// Potency on a status the family never applies does nothing.
function potencyIssues(
  node: SkillTreeNodeContent,
  modifier: HeroEffectSkillModifier,
  familySkills: EquipmentSkillContent[],
): AnalysisIssue[] {
  if (modifier.modifier !== 'Potency') return [];
  const applies = familySkills.some((skill) =>
    skill.techniques.some((technique) =>
      technique.statusEffects.some(
        (status) => status.statusEffectId === modifier.statusEffectId,
      ),
    ),
  );
  return applies
    ? []
    : [
        analysisWarn(
          `${node.name}: ${modifier.family} never applies that status.`,
        ),
      ];
}

function modifierIssues(
  nodes: SkillTreeNodeContent[],
  node: SkillTreeNodeContent,
  modifier: HeroEffectSkillModifier,
): AnalysisIssue[] {
  const familySkills = skillTreeGrantedSkills(nodes).filter(
    (skill) => skill.family === modifier.family,
  );
  if (familySkills.length === 0) {
    return [
      analysisFail(
        `${node.name}: modifies ${modifier.family}, which this tree never grants.`,
      ),
    ];
  }
  return [
    ...referenceIssues(node, modifier),
    ...potencyIssues(node, modifier, familySkills),
  ];
}

// Skill modifiers are oath options, so a hero always picks one of the pair.
function placementIssues(
  nodes: SkillTreeNodeContent[],
  node: SkillTreeNodeContent,
): AnalysisIssue[] {
  return skillTreeOptionOath(nodes, node.id)
    ? []
    : [analysisFail(`${node.name}: a skill modifier must be an oath option.`)];
}

// An oath frame holds two nodes side by side, so it overlaps anything on a neighbouring track in its row.
function oathNeighbourIssues(nodes: SkillTreeNodeContent[]): AnalysisIssue[] {
  const oaths = nodes.filter(
    (node) => node.row !== '' && node.optionSkillTreeNodeIds.length > 0,
  );
  return oaths.flatMap((oath) =>
    nodes
      .filter(
        (other) =>
          other.row === oath.row &&
          other.level === oath.level &&
          Math.abs(other.track - oath.track) === 1,
      )
      .map((other) =>
        analysisWarn(`${oath.name}: overlaps ${other.name} beside it.`),
      ),
  );
}

export function skillTreeModifierIssues(
  nodes: SkillTreeNodeContent[],
): AnalysisIssue[] {
  return [
    ...oathNeighbourIssues(nodes),
    ...nodes.flatMap((node) => {
      const modifiers = skillTreeNodeModifiers(node);
      if (modifiers.length === 0) return [];
      return [
        ...placementIssues(nodes, node),
        ...modifiers.flatMap((modifier) =>
          modifierIssues(nodes, node, modifier),
        ),
      ];
    }),
  ];
}

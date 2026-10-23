import { formatNumber, NgTemplateOutlet } from '@angular/common';
import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { DetailSkillPreviewComponent } from '@components/detail-skill-preview/detail-skill-preview.component';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { RowItemStatsComponent } from '@components/row-item-stats/row-item-stats.component';
import { RowSkillModifierComponent } from '@components/row-skill-modifier/row-skill-modifier.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { TooltipSkillPreviewComponent } from '@components/tooltip-skill-preview/tooltip-skill-preview.component';
import { SFXDirective } from '@directives/sfx.directive';
import { combatantFromCharacter } from '@helpers/combat/combat-create';
import { SKILL_TREE_NODE_SIZE } from '@helpers/config';
import {
  characterSkillPreview,
  skillTreeNodeModifierLines,
} from '@helpers/hero/skill-modifier.ui';
import { skillTreeNodeShortName } from '@helpers/hero/skill-tree-content';
import {
  skillTreeNodeArt,
  skillTreeNodeEffectText,
  skillTreeNodeRequirements,
  skillTreeNodeStatsPerLevel,
  skillTreeNodeValueText,
} from '@helpers/hero/skill-tree-layout.ui';
import {
  skillTreeNodeKind,
  skillTreeNodeSkill,
} from '@helpers/hero/skill-tree-node';
import {
  affixEffectsHaveStatSummary,
  affixEffectsStatSummary,
} from '@helpers/item/equipment-bonus';
import { equippedItemTypes } from '@helpers/item/equipment';
import type {
  Character,
  JobContent,
  SkillTreeNodeContent,
  SkillTreeNodeId,
  SkillTreeNodeState,
} from '@interfaces';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-panel-heroes-skill-tree-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    IconItemPreviewComponent,
    RowItemStatsComponent,
    RowSkillModifierComponent,
    RowStatSummaryComponent,
    SFXDirective,
    DetailSkillPreviewComponent,
    NgTemplateOutlet,
    TooltipSkillPreviewComponent,
  ],
  templateUrl: './panel-heroes-skill-tree-detail.component.html',
})
export class PanelHeroesSkillTreeDetailComponent {
  public node = input<SkillTreeNodeContent>();
  public states = input.required<Map<SkillTreeNodeId, SkillTreeNodeState>>();
  public job = input.required<JobContent>();
  public character = input.required<Character>();
  public staged = input<SkillTreeNodeId[]>([]);
  public learn = output<SkillTreeNodeId>();
  public unlearn = output<SkillTreeNodeId>();

  private anim = inject(AnimationService);
  private locale = inject(LOCALE_ID);
  private format = (value: number) => formatNumber(value, this.locale);
  public readonly nodeSize = SKILL_TREE_NODE_SIZE;

  public combatant = computed(() => combatantFromCharacter(this.character()));
  public weaponTypes = computed(() =>
    equippedItemTypes(this.character().equipment),
  );

  public state = computed(() => {
    const node = this.node();
    return node ? this.states().get(node.id) : undefined;
  });

  public details = computed(() => {
    const node = this.node();
    if (!node) return undefined;

    const content = skillTreeNodeSkill(node);

    return {
      node,
      name: skillTreeNodeShortName(node),
      kind: skillTreeNodeKind(node),
      art: skillTreeNodeArt(node, this.job()),
      skill: content
        ? characterSkillPreview(this.character(), content, this.staged())
        : undefined,
      effect: skillTreeNodeEffectText(node),
      modifierLines: skillTreeNodeModifierLines(node, this.format),
      statSummary: affixEffectsHaveStatSummary(node.effects)
        ? affixEffectsStatSummary(node.effects)
        : undefined,
      statsPerLevel: skillTreeNodeStatsPerLevel(node),
      value: skillTreeNodeValueText(node),
      requires: skillTreeNodeRequirements(node, this.job()),
    };
  });

  public onEnter(event: AnimationCallbackEvent): void {
    this.anim.popIn(event.target);
  }

  public onLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}

import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { SFXDirective } from '@directives/sfx.directive';
import { AnimationService } from '@services/animation.service';
import { skillTreeNodeShortName } from '@helpers/hero/skill-tree-content';
import { SKILL_TREE_NODE_SIZE } from '@helpers/config';
import {
  skillTreeNodeArt,
  skillTreeNodeEffectText,
  skillTreeNodeKind,
  skillTreeNodeRequirements,
  skillTreeNodeSkill,
  skillTreeNodeValueText,
} from '@helpers/hero/skill-tree-layout.ui';
import { combatantFromCharacter } from '@helpers/combat/combat-create';
import { skillDescriptionWithPreview } from '@helpers/hero/skill-preview';
import type {
  Character,
  JobContent,
  SkillTreeNodeContent,
  SkillTreeNodeId,
  SkillTreeNodeState,
} from '@interfaces';

@Component({
  selector: 'app-panel-heroes-skill-tree-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BlankSlateComponent, IconItemPreviewComponent, SFXDirective],
  templateUrl: './panel-heroes-skill-tree-detail.component.html',
})
export class PanelHeroesSkillTreeDetailComponent {
  public node = input<SkillTreeNodeContent>();
  public state = input<SkillTreeNodeState>();
  public job = input.required<JobContent>();
  public character = input.required<Character>();
  public learn = output<SkillTreeNodeId>();
  public unlearn = output<SkillTreeNodeId>();

  private anim = inject(AnimationService);
  public readonly nodeSize = SKILL_TREE_NODE_SIZE;

  public details = computed(() => {
    const node = this.node();
    if (!node) return undefined;

    const skill = skillTreeNodeSkill(node);

    return {
      node,
      name: skillTreeNodeShortName(node),
      kind: skillTreeNodeKind(node),
      art: skillTreeNodeArt(node, this.job()),
      effect: skill
        ? skillDescriptionWithPreview(
            combatantFromCharacter(this.character()),
            skill,
          )
        : skillTreeNodeEffectText(node),
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

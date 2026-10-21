import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { SFXDirective } from '@directives/sfx.directive';
import {
  SKILL_TREE_COLUMN_GAP,
  SKILL_TREE_NODE_SIZE,
  SKILL_TREE_OATH_BORDER,
  SKILL_TREE_OATH_OPTION_GAP,
  SKILL_TREE_OATH_PADDING,
} from '@helpers/config';
import {
  skillTreeJobNodes,
  skillTreeNodeShortName,
} from '@helpers/hero/skill-tree-content';
import {
  skillTreeArrows,
  skillTreeLayout,
  skillTreeNodeArt,
  skillTreeNodeKind,
} from '@helpers/hero/skill-tree-layout.ui';
import { skillTreeOathChoice } from '@helpers/hero/skill-tree.ui';
import type {
  JobContent,
  SkillTreeLayoutArrow,
  SkillTreeLayoutBox,
  SkillTreeNodeContent,
  SkillTreeNodeId,
  SkillTreeNodeState,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-heroes-skill-tree-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconItemPreviewComponent,
    NgTemplateOutlet,
    SFXDirective,
    TippyDirective,
  ],
  templateUrl: './panel-heroes-skill-tree-grid.component.html',
  styleUrl: './panel-heroes-skill-tree-grid.component.scss',
})
export class PanelHeroesSkillTreeGridComponent {
  public job = input.required<JobContent>();
  public heroLevel = input.required<number>();
  public states = input.required<Map<SkillTreeNodeId, SkillTreeNodeState>>();
  public selectedId = input<SkillTreeNodeId>();
  public selected = output<SkillTreeNodeId>();
  public learnRequested = output<SkillTreeNodeId>();

  public readonly nodeSize = SKILL_TREE_NODE_SIZE;
  public readonly columnGap = SKILL_TREE_COLUMN_GAP;
  public readonly oathPadding = SKILL_TREE_OATH_PADDING;
  public readonly oathBorder = SKILL_TREE_OATH_BORDER;
  public readonly oathOptionGap = SKILL_TREE_OATH_OPTION_GAP;
  public readonly arrowKinds = ['learned', 'pending', 'idle'];
  public layout = computed(() => skillTreeLayout(this.job()));

  private overlay = viewChild.required<ElementRef<HTMLElement>>('overlay');
  private boxElements = viewChildren('box', { read: ElementRef });
  private boxes = signal(new Map<SkillTreeNodeId, SkillTreeLayoutBox>());
  public arrows = computed(() =>
    skillTreeArrows(skillTreeJobNodes(this.job().id), this.boxes()),
  );

  // Rows past the hero's level are shaded from this grid row down.
  public lockedFromRow = computed(
    () =>
      this.layout().levels.find((level) => level.level > this.heroLevel())
        ?.gridRow,
  );

  constructor() {
    // Arrows join the rendered nodes, so they are re-measured whenever the tree redraws or resizes.
    afterRenderEffect({
      read: () => {
        this.boxElements();
        this.measure();
      },
    });
    const observer = new ResizeObserver(() => this.measure());
    afterNextRender(() => observer.observe(this.overlay().nativeElement));
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  private measure(): void {
    const overlay = this.overlay().nativeElement;
    const origin = overlay.getBoundingClientRect();
    // Rects come back in zoomed screen px (UI scale), but the svg draws in the overlay's own px.
    const zoom =
      overlay.offsetWidth > 0 ? origin.width / overlay.offsetWidth : 1;
    const boxes = new Map<SkillTreeNodeId, SkillTreeLayoutBox>();
    this.boxElements().forEach((ref) => {
      const element = ref.nativeElement as HTMLElement;
      const rect = element.getBoundingClientRect();
      boxes.set(element.dataset['boxId'] as SkillTreeNodeId, {
        x: Math.round((rect.left - origin.left) / zoom),
        y: Math.round((rect.top - origin.top) / zoom),
        width: Math.round(rect.width / zoom),
        height: Math.round(rect.height / zoom),
      });
    });
    this.boxes.set(boxes);
  }

  public stateOf(id: SkillTreeNodeId): SkillTreeNodeState {
    return this.states().get(id) ?? 'locked';
  }

  public arrowState(arrow: SkillTreeLayoutArrow): string {
    const state = this.stateOf(arrow.toId);
    return state === 'learned' || state === 'pending' ? state : 'idle';
  }

  public art(node: SkillTreeNodeContent) {
    return skillTreeNodeArt(node, this.job());
  }

  public isSkill(node: SkillTreeNodeContent): boolean {
    return skillTreeNodeKind(node) === 'Skill';
  }

  public oathChoice(oath: SkillTreeNodeContent) {
    return skillTreeOathChoice(oath, this.states());
  }

  public name(node: SkillTreeNodeContent): string {
    return skillTreeNodeShortName(node);
  }
}

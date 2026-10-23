import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { TooltipStatusEffectComponent } from '@components/tooltip-statuseffect/tooltip-statuseffect.component';
import type { SkillModifierLineSegment } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-icon-skill-modifier-segment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconItemPreviewComponent,
    TippyDirective,
    TooltipStatusEffectComponent,
  ],
  host: { class: 'inline-flex' },
  template: `
    @let entry = segment();

    <ng-template #statusTooltip>
      @if (entry.statusEffect; as effect) {
        <app-tooltip-statuseffect [effect]="effect" />
      }
    </ng-template>

    @if (entry.art; as art) {
      @let content = tooltip();
      <span
        class="relative inline-block overflow-hidden shrink-0 w-4 h-4"
        [tp]="content"
        [tpData]="entry.skill"
        [tpIsEnabled]="!!content"
      >
        <app-icon-item-preview
          [sprite]="art.sprite"
          [spritesheet]="art.spritesheet"
          cssClass="zoom-inline"
        />
      </span>
    }
  `,
})
export class IconSkillModifierSegmentComponent {
  public segment = input.required<SkillModifierLineSegment>();
  // Supplied by the host, since the skill tooltip itself renders these rows.
  public skillTooltip = input<TemplateRef<unknown>>();

  private statusTooltip =
    viewChild.required<TemplateRef<unknown>>('statusTooltip');

  public tooltip = computed(() => {
    const segment = this.segment();
    if (segment.skill) return this.skillTooltip();
    return segment.statusEffect ? this.statusTooltip() : undefined;
  });
}

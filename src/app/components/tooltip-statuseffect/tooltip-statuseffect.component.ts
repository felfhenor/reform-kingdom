import { TPipe } from '@pipes/t.pipe';
import { TPluralPipe } from '@pipes/t-plural.pipe';
import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconDimensionComponent } from '@components/icon-dimension/icon-dimension.component';
import { IconComponent } from '@components/icon/icon.component';
import type { StatusEffectPreview } from '@interfaces';
import { StatDimension, StatusEffectTagDimension } from '@interfaces';

@Component({
  selector: 'app-tooltip-statuseffect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    TPluralPipe,
    DecimalPipe,
    AtlasImageComponent,
    IconComponent,
    IconDimensionComponent,
  ],
  templateUrl: './tooltip-statuseffect.component.html',
})
export class TooltipStatusEffectComponent {
  public effect = input.required<StatusEffectPreview>();

  public tagDimension = StatusEffectTagDimension;
  public statDimension = StatDimension;
  public tagLabels = StatusEffectTagDimension.label;

  public isBuff = computed(() => this.effect().effectType === 'Buff');
  public typeLabel = computed(() => {
    const { elements, effectType } = this.effect();
    return [...elements, effectType].join(' ');
  });
}

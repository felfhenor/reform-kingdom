import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { TooltipStatusEffectComponent } from '@components/tooltip-statuseffect/tooltip-statuseffect.component';
import type { StatusEffectPreview } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-icon-statuseffect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    AtlasImageComponent,
    TippyDirective,
    TooltipStatusEffectComponent,
  ],
  templateUrl: './icon-statuseffect.component.html',
  styleUrl: './icon-statuseffect.component.scss',
})
export class IconStatusEffectComponent {
  public effect = input.required<StatusEffectPreview>();

  public isBuff = computed(() => this.effect().effectType === 'Buff');
}

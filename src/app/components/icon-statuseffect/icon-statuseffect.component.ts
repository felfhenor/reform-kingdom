import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconComponent } from '@components/icon/icon.component';
import { IconStatComponent } from '@components/icon-stat/icon-stat.component';
import type { StatusEffectPreview } from '@interfaces';
import { StatusEffectTagDimension } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { PluralizePipe } from '@pipes/pluralize.pipe';

@Component({
  selector: 'app-icon-statuseffect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    AtlasImageComponent,
    IconComponent,
    IconStatComponent,
    PluralizePipe,
    TippyDirective,
  ],
  templateUrl: './icon-statuseffect.component.html',
  styleUrl: './icon-statuseffect.component.scss',
})
export class IconStatusEffectComponent {
  public effect = input.required<StatusEffectPreview>();

  public tagIcons = StatusEffectTagDimension.icon;
  public tagLabels = StatusEffectTagDimension.label;

  public isBuff = computed(() => this.effect().effectType === 'Buff');
  public typeLabel = computed(() => {
    const { elements, effectType } = this.effect();
    return [...elements, effectType].join(' ');
  });
  public triggerLabel = computed(() =>
    this.effect().trigger === 'TurnStart' ? 'start' : 'end',
  );
}

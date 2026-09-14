import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { globalEffectEffectDescription } from '@helpers/hero/global-effect-state';
import type { GlobalEffectEffect } from '@interfaces';

@Component({
  selector: 'app-detail-collectible-effects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './detail-collectible-effects.component.html',
  styleUrl: './detail-collectible-effects.component.scss',
})
export class DetailCollectibleEffectsComponent {
  public effects = input.required<GlobalEffectEffect[]>();

  public effectLabels = computed(() =>
    this.effects().map(globalEffectEffectDescription),
  );
}

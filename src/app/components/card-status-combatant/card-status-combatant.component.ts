import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CombatStatusPlaybackService } from '@services/combat-status-playback.service';
import type { StatusCardEntry } from '@interfaces';

// Random X jitter so a burst of hits doesn't stream from one spot - smaller
// range when collapsed since the card itself is narrower.
const EXPANDED_X_JITTER_PERCENT = 30;
const COLLAPSED_X_JITTER_PERCENT = 12;

@Component({
  selector: 'app-card-status-combatant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, AtlasAnimationComponent, AtlasImageComponent],
  templateUrl: './card-status-combatant.component.html',
  styleUrl: './card-status-combatant.component.scss',
})
export class CardStatusCombatantComponent {
  private playback = inject(CombatStatusPlaybackService);

  public entry = input.required<StatusCardEntry>();
  public expanded = input<boolean>(false);

  public damageNumbersByCombatant = this.playback.damageNumbersByCombatant;
  public skillCastByCombatant = this.playback.skillCastByCombatant;

  public xOffsetPercent(seed: number): number {
    const range = this.expanded()
      ? EXPANDED_X_JITTER_PERCENT
      : COLLAPSED_X_JITTER_PERCENT;
    return 50 + seed * range;
  }
}

import { DecimalPipe, UpperCasePipe } from '@angular/common';
import type { ElementRef, AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { damageNumberScale } from '@helpers/combat/combat-damage-events.ui';
import { heroLevelUpVfx$ } from '@helpers/engine/hero-level-up-vfx';
import type { DamageEventVariant, StatusCardEntry } from '@interfaces';
import { AnimationService } from '@services/animation.service';
import type { JSAnimation } from 'animejs';
import { CombatStatusPlaybackService } from '@services/combat-status-playback.service';

// Random X jitter so a burst of hits doesn't stream from one spot - smaller
// range when collapsed since the card itself is narrower.
const EXPANDED_X_JITTER_PERCENT = 36;
const COLLAPSED_X_JITTER_PERCENT = 18;

@Component({
  selector: 'app-card-status-combatant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    AtlasAnimationComponent,
    AtlasImageComponent,
    UpperCasePipe,
  ],
  templateUrl: './card-status-combatant.component.html',
  styleUrl: './card-status-combatant.component.scss',
})
export class CardStatusCombatantComponent {
  private playback = inject(CombatStatusPlaybackService);
  private anim = inject(AnimationService);

  private card = viewChild<ElementRef<HTMLElement>>('card');
  private levelUpAnimation?: JSAnimation;

  public entry = input.required<StatusCardEntry>();
  public expanded = input<boolean>(false);

  public damageNumbersByCombatant = this.playback.damageNumbersByCombatant;
  public skillCastByCombatant = this.playback.skillCastByCombatant;

  constructor() {
    const levelUpSubscription = heroLevelUpVfx$.subscribe((characterId) => {
      if (characterId !== this.entry().combatantId) return;

      const card = this.card()?.nativeElement;
      if (!card || this.levelUpAnimation?.completed === false) return;

      this.levelUpAnimation = this.anim.levelUp(card);
    });
    inject(DestroyRef).onDestroy(() => levelUpSubscription.unsubscribe());
  }

  public onDamageNumberEnter(
    event: AnimationCallbackEvent,
    amount: number,
    variant?: DamageEventVariant,
  ): void {
    const maxHp =
      this.entry().bars.find((bar) => bar.variant === 'hp')?.max ?? 0;

    this.anim.damageNumber(event.target, {
      lifetimeMs: this.playback.damageNumberLifetimeMs(variant),
      isHeal: amount > 0,
      variant,
      scale: damageNumberScale(amount, maxHp),
    });
  }

  public xOffsetPercent(seed: number): number {
    const range = this.expanded()
      ? EXPANDED_X_JITTER_PERCENT
      : COLLAPSED_X_JITTER_PERCENT;
    return seed * range;
  }
}

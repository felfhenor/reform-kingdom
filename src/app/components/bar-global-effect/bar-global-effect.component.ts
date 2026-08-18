import {
  ChangeDetectionStrategy,
  Component,
  effect,
  signal,
  untracked,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { autoModeStatusLabel } from '@helpers/auto-mode';
import {
  activeGlobalEffects,
  globalEffectDurationLabel,
} from '@helpers/global-effects';
import type { GlobalEffect } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

const FADE_DURATION_MS = 300;

type EffectPhase = 'entering' | 'visible' | 'leaving';
type DisplayedEffect = GlobalEffect & { phase: EffectPhase };

@Component({
  selector: 'app-bar-global-effect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, TippyDirective],
  template: `
    @if (displayedEffects().length > 0) {
      <ul class="flex gap-2 items-center p-2 bg-transparent">
        @for (effect of displayedEffects(); track effect.id) {
          <li
            class="global-effect-box tooltip tooltip-bottom"
            [class.entering]="effect.phase === 'entering'"
            [class.leaving]="effect.phase === 'leaving'"
            [tp]="effect.name + ': ' + effectDescription(effect)"
            [tpPlacement]="'bottom'"
          >
            <app-atlas-image
              class="absolute w-full h-full"
              spritesheet="globaleffect"
              [assetName]="effect.sprite"
            />

            @if (effect.name !== 'Idle' && effect.name !== 'Auto Mode') {
              <div class="duration z-15 text-lg">
                {{ durationLabel(effect) }}
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .global-effect-box {
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      border: 1px solid currentColor;
      border-radius: 0.25rem;
      opacity: 0.85;
      background: transparent;
      transition: opacity 300ms ease;

      &.entering,
      &.leaving {
        opacity: 0;
      }
    }

    .duration {
      text-shadow:
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000;
    }
  `,
})
export class BarGlobalEffectComponent {
  public displayedEffects = signal<DisplayedEffect[]>([]);
  public durationLabel = globalEffectDurationLabel;

  // Auto Mode's description is live status text, computed at render time rather than stored in gamestate since it changes often.
  public effectDescription(effect: GlobalEffect): string {
    if (effect.name !== 'Auto Mode') return effect.description;
    return autoModeStatusLabel() ?? effect.description;
  }

  constructor() {
    // `untracked` avoids self-retrigger, since `syncDisplayedEffects` both reads and writes `displayedEffects`.
    effect(() => {
      const active = activeGlobalEffects();
      untracked(() => this.syncDisplayedEffects(active));
    });
  }

  // Keeps expiring effects mounted for one fade cycle and fades new ones in, so a same-tick swap (e.g. Deaths Door -> Healing) reads as a hand-off, not a jump cut.
  private syncDisplayedEffects(active: GlobalEffect[]): void {
    const activeIds = new Set(active.map((effect) => effect.id));
    const current = this.displayedEffects();
    const currentIds = new Set(current.map((effect) => effect.id));

    const kept = current
      .filter((effect) => activeIds.has(effect.id))
      .map((effect) => ({ ...effect, phase: 'visible' as const }));

    const stillLeaving = current.filter(
      (effect) => !activeIds.has(effect.id) && effect.phase === 'leaving',
    );

    const arriving = active
      .filter((effect) => !currentIds.has(effect.id))
      .map((effect) => ({ ...effect, phase: 'entering' as const }));

    const newlyLeaving = current
      .filter(
        (effect) => !activeIds.has(effect.id) && effect.phase !== 'leaving',
      )
      .map((effect) => ({ ...effect, phase: 'leaving' as const }));

    this.displayedEffects.set([
      ...kept,
      ...arriving,
      ...stillLeaving,
      ...newlyLeaving,
    ]);

    if (arriving.length > 0) {
      requestAnimationFrame(() => {
        this.displayedEffects.update((effects) =>
          effects.map((effect) =>
            effect.phase === 'entering'
              ? { ...effect, phase: 'visible' }
              : effect,
          ),
        );
      });
    }

    if (newlyLeaving.length > 0) {
      setTimeout(() => {
        this.displayedEffects.update((effects) =>
          effects.filter((effect) => effect.phase !== 'leaving'),
        );
      }, FADE_DURATION_MS);
    }
  }
}

import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { TooltipGlobalEffectComponent } from '@components/tooltip-global-effect/tooltip-global-effect.component';
import { autoModeStatusLabel } from '@helpers/decree/auto-mode.ui';
import {
  activeGlobalEffects,
  globalEffectDurationLabel,
} from '@helpers/hero/global-effects';
import type { GlobalEffect } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-bar-global-effect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, TippyDirective, TooltipGlobalEffectComponent],
  host: {
    class: 'min-h-[80px]',
  },
  template: `
    @if (displayedEffects().length > 0) {
      <ul class="flex gap-2 items-center p-2 bg-transparent">
        @for (effect of displayedEffects(); track effect.id) {
          <app-tooltip-global-effect
            #effectTooltip
            [effect]="effect"
            [description]="effectDescription(effect)"
          />

          <li
            class="global-effect-box text-sm tooltip tooltip-bottom"
            [tp]="effectTooltip.template()"
            [tpPlacement]="'bottom'"
            (animate.enter)="onEnter($event)"
            (animate.leave)="onLeave($event)"
          >
            <app-atlas-image
              class="absolute w-full h-full"
              spritesheet="globaleffect"
              [assetName]="effect.sprite"
            />

            @if (!effect.hideDuration) {
              <div class="duration z-15 text-lg tabular-nums">
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
      border: 1px solid currentColor;
      border-radius: 0.25rem;
      opacity: 0.85;
      background: transparent;
      contain: content;
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
  private anim = inject(AnimationService);

  public displayedEffects = computed(() => activeGlobalEffects());
  public durationLabel = globalEffectDurationLabel;

  // Auto Mode's description is live status text, computed at render time rather than stored in gamestate since it changes often.
  public effectDescription(effect: GlobalEffect): string {
    if (effect.name !== 'Auto Mode') return effect.description;
    return autoModeStatusLabel() ?? effect.description;
  }

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

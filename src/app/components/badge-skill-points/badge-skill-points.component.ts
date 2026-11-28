import { TPipe } from '@pipes/t.pipe';
import type { AnimationCallbackEvent } from '@angular/core';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TippyDirective } from '@ngneat/helipopper';
import { characterSkillTreeAvailableSp } from '@helpers/hero/skill-tree';
import { AnimationService } from '@services/animation.service';
import type { Character } from '@interfaces';

// A component boundary, not an inline @if: Angular removes a reordered @for row late when its own view holds a nested leave animation.
@Component({
  selector: 'app-badge-skill-points',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, DecimalPipe, TippyDirective],
  host: { class: 'contents' },
  template: `
    @let sp = freeSp();
    @if (sp > 0) {
      @if (dot()) {
        <span
          class="absolute inset-0"
          [tp]="(sp | number) + ' SP available'"
          (animate.enter)="onEnter($event)"
          (animate.leave)="onLeave($event)"
        >
          <i class="status-dot text-attention"></i>
        </span>
      } @else {
        <span
          class="badge badge-sm badge-attention tabular-nums"
          (animate.enter)="onEnter($event)"
          (animate.leave)="onLeave($event)"
        >
          {{ 'badgeSkillPoints.sp' | t: { sp: (sp | number) } }}
        </span>
      }
    }
  `,
})
export class BadgeSkillPointsComponent {
  private anim = inject(AnimationService);
  public character = input.required<Character>();
  // Corner dot over a relative parent instead of the full badge.
  public dot = input(false, { transform: booleanAttribute });

  public freeSp = computed(() => {
    const character = this.character();
    return characterSkillTreeAvailableSp(character, character.jobId);
  });

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

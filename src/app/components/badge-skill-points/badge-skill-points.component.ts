import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { characterSkillTreeAvailableSp } from '@helpers/hero/skill-tree';
import { AnimationService } from '@services/animation.service';
import type { Character } from '@interfaces';

// A component boundary, not an inline @if: Angular removes a reordered @for row late when its own view holds a nested leave animation.
@Component({
  selector: 'app-badge-skill-points',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  host: { class: 'contents' },
  template: `
    @let sp = freeSp();
    @if (sp > 0) {
      <span
        class="badge badge-sm badge-attention tabular-nums"
        (animate.enter)="onEnter($event)"
        (animate.leave)="onLeave($event)"
      >
        {{ sp | number }} SP
      </span>
    }
  `,
})
export class BadgeSkillPointsComponent {
  private anim = inject(AnimationService);
  public character = input.required<Character>();

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

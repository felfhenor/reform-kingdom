import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { AdventureLogMessageComponent } from '@components/adventure-log-message/adventure-log-message.component';
import { combatLog } from '@helpers/combat/combat-log';
import { adventureLogOverlayEntries } from '@helpers/combat/combat-log.ui';
import { clockState } from '@helpers/state-game';
import { getOption } from '@helpers/state-options';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-adventure-log-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdventureLogMessageComponent],
  template: `
    @if (isEnabled()) {
      @for (entry of entries(); track entry.messageId) {
        <div
          class="overlay-line"
          (animate.enter)="onEnter($event)"
          (animate.leave)="onLeave($event)"
        >
          <app-adventure-log-message [entry]="entry" />
        </div>
      }
    }
  `,
  styleUrl: './adventure-log-overlay.component.scss',
})
export class AdventureLogOverlayComponent {
  private anim = inject(AnimationService);

  public isEnabled = computed(() => getOption('adventureLogOverlay'));

  public entries = computed(() =>
    adventureLogOverlayEntries(
      combatLog(),
      clockState().numTicks,
      getOption('adventureLogOverlayKinds'),
    ),
  );

  public onEnter(event: AnimationCallbackEvent): void {
    this.anim.slideIn(event.target);
  }

  public onLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}

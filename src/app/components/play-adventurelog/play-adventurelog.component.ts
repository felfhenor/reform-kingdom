import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { combatLog } from '@helpers/combat/combat-log';
import {
  adventureLogMessageParts,
  adventureLogTimestampTooltip,
} from '@helpers/combat/combat-log.ui';
import { TippyDirective } from '@ngneat/helipopper';
import { TimeagoPipe } from 'ngx-timeago';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-play-adventurelog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CardPageComponent,
    SlotIconBlankComponent,
    TimeagoPipe,
    TippyDirective,
  ],
  templateUrl: './play-adventurelog.component.html',
})
export class PlayAdventureLogComponent {
  private anim = inject(AnimationService);

  // Snapshot of entries already present on open, so loading history doesn't replay hundreds of enter animations at once - only genuinely new entries animate in.
  private initialEntryIds = new Set(
    combatLog()
      .filter((entry) => entry.message.trim() !== '')
      .map((entry) => entry.messageId),
  );

  public entries = computed(() =>
    combatLog().filter((entry) => entry.message.trim() !== ''),
  );

  public messageParts = adventureLogMessageParts;
  public timestampTooltip = adventureLogTimestampTooltip;

  public onEnter(event: AnimationCallbackEvent, messageId: string): void {
    if (this.initialEntryIds.has(messageId)) return;
    this.anim.slideIn(event.target);
  }

  public onLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}

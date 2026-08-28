import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import {
  adventureLogEntryHtml,
  adventureLogTimestampTooltip,
  combatLog,
} from '@helpers/combat/combat-log';
import { TippyDirective } from '@ngneat/helipopper';
import { TimeagoPipe } from 'ngx-timeago';

@Component({
  selector: 'app-play-adventurelog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent, TimeagoPipe, TippyDirective],
  templateUrl: './play-adventurelog.component.html',
})
export class PlayAdventureLogComponent {
  public entries = computed(() =>
    combatLog().filter((entry) => entry.message.trim() !== ''),
  );

  public messageHtml = adventureLogEntryHtml;
  public timestampTooltip = adventureLogTimestampTooltip;
}

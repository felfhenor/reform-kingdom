import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import {
  adventureLogMessageHtml,
  adventureLogTimestampTooltip,
  combatLog,
  combatLogHealthColor,
} from '@helpers/combat-log';
import type { CombatLog } from '@interfaces';
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

  public messageHtml = adventureLogMessageHtml;
  public timestampTooltip = adventureLogTimestampTooltip;

  public messageColor(entry: CombatLog): string {
    if (entry.colorOverride) return entry.colorOverride;
    if (entry.hp === undefined || !entry.maxHp) return '';
    return combatLogHealthColor(entry.hp, entry.maxHp);
  }
}

import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
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
  public entries = computed(() =>
    combatLog().filter((entry) => entry.message.trim() !== ''),
  );

  public messageParts = adventureLogMessageParts;
  public timestampTooltip = adventureLogTimestampTooltip;
}

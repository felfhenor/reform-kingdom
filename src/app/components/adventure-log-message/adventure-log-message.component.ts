import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { adventureLogMessageParts } from '@helpers/combat/combat-log.ui';
import type { CombatLog } from '@interfaces';

@Component({
  selector: 'app-adventure-log-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, SlotIconBlankComponent],
  host: { class: 'contents' },
  templateUrl: './adventure-log-message.component.html',
})
export class AdventureLogMessageComponent {
  public entry = input.required<CombatLog>();

  public parts = computed(() => adventureLogMessageParts(this.entry()));
}

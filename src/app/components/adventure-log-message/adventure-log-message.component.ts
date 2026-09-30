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
  // Inline flow, not flex, so a message with many icons wraps like text instead of overflowing.
  host: { class: 'block flex-1 min-w-0' },
  templateUrl: './adventure-log-message.component.html',
})
export class AdventureLogMessageComponent {
  public entry = input.required<CombatLog>();

  public parts = computed(() => adventureLogMessageParts(this.entry()));
}

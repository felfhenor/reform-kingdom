import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';

@Component({
  selector: 'app-icon-unknown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlotIconBlankComponent, IconComponent],
  template: `
    <app-slot-icon-blank>
      <app-icon name="gameHelp" size="32px" />
    </app-slot-icon-blank>
  `,
})
export class IconUnknownComponent {}

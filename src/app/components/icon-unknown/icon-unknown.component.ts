import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';

@Component({
  selector: 'app-icon-unknown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconBlankSlotComponent, IconComponent],
  template: `
    <app-icon-blank-slot>
      <app-icon name="gameHelp" size="32px" />
    </app-icon-blank-slot>
  `,
})
export class IconUnknownComponent {}

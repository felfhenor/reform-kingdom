import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-slot-icon-blank',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './slot-icon-blank.component.html',
  styleUrl: './slot-icon-blank.component.scss'
})
export class SlotIconBlankComponent {
  // Off for plain icons (e.g. a currency icon inline with text) that
  // shouldn't look like an item sitting in a gear/inventory slot.
  public showBackground = input(true);
}

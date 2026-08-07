import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-icon-blank-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './icon-blank-slot.component.html',
  styleUrl: './icon-blank-slot.component.scss'
})
export class IconBlankSlotComponent {
  // Off for plain icons (e.g. a currency icon inline with text) that
  // shouldn't look like an item sitting in a gear/inventory slot.
  public showBackground = input(true);
}

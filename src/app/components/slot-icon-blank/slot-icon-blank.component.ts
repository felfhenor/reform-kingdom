import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-slot-icon-blank',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './slot-icon-blank.component.html',
  styleUrl: './slot-icon-blank.component.scss',
})
export class SlotIconBlankComponent {
  public showBackground = input(true);
}

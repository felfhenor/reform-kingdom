import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

@Component({
  selector: 'app-card-status-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.expanded]': 'expanded()',
  },
  templateUrl: './card-status-bubble.component.html',
  styleUrl: './card-status-bubble.component.scss',
})
export class CardStatusBubbleComponent {
  public expanded = input<boolean>(false);
  public name = input.required<string>();
  public badge = input<string>();
  public badgeNumeric = input(false, { transform: booleanAttribute });
  public dimmed = input<boolean>(false);
}

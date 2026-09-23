import { Component, input } from '@angular/core';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  imports: [TippyDirective],
  selector: 'app-slot-button-container',
  styleUrl: './slot-button-container.component.scss',
  templateUrl: './slot-button-container.component.html',
})
export class SlotButtonContainerComponent {
  public helpText = input<string>('');
  public disabled = input<boolean>(false);
}

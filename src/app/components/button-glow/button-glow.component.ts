import { Component, input } from '@angular/core';

@Component({
  selector: 'app-button-glow, [appButtonGlow]',
  imports: [],
  templateUrl: './button-glow.component.html',
  styleUrl: './button-glow.component.scss',
  host: {
    '[class.button-glow-active]': 'buttonGlowActive()',
  },
})
export class ButtonGlowComponent {
  public buttonGlowActive = input<boolean>(true);
}

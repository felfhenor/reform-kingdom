import { Component, computed, inject, input } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { FFInputPromptComponent } from '@ff/components/input-prompt/input-prompt.component';
import { FFInputService } from '@ff/input/ff-input.service';

@Component({
  selector: 'app-button-close',
  imports: [IconComponent, SFXDirective, FFInputPromptComponent],
  providers: [],
  templateUrl: './button-close.component.html',
  styleUrl: './button-close.component.scss',
})
export class ButtonCloseComponent {
  // Only where B actually closes this, e.g. the topmost modal.
  public showBackPrompt = input<boolean>(false);

  private readonly ffInput = inject(FFInputService);
  protected isGamepadMode = computed(() => this.ffInput.mode() === 'gamepad');
}

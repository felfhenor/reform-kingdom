import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ButtonGlowDirective } from '@directives/button-glow.directive';
import { CardStatusBubbleComponent } from '@components/card-status-bubble/card-status-bubble.component';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { tutorialStart } from '@helpers/tutorial/tutorial-engine.ui';
import type { TutorialUnlockStatusEntry } from '@interfaces';

@Component({
  selector: 'app-card-status-tutorial-unlock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonGlowDirective,
    CardStatusBubbleComponent,
    IconComponent,
    SFXDirective,
  ],
  templateUrl: './card-status-tutorial-unlock.component.html',
  styleUrl: './card-status-tutorial-unlock.component.scss',
})
export class CardStatusTutorialUnlockComponent {
  public entry = input.required<TutorialUnlockStatusEntry>();
  public expanded = input<boolean>(false);

  public select(): void {
    tutorialStart(this.entry().tutorialId);
  }
}

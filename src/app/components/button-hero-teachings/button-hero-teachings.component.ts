import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SFXDirective } from '@directives/sfx.directive';
import { TutorialTargetDirective } from '@directives/tutorial-target.directive';
import { heroTeachingsModalOpen } from '@helpers/engine/ui';
import type { CharacterId } from '@interfaces';

@Component({
  selector: 'app-button-hero-teachings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SFXDirective, TutorialTargetDirective],
  host: {
    class: 'w-full',
  },
  template: `
    <button
      class="btn btn-sm btn-block btn-secondary"
      (click)="open()"
      appTutorialTarget="hero-teachings"
      appSfx="ui-click"
      [sfxOffset]="0"
      [sfxTrigger]="['click', 'hover']"
    >
      Teachings
    </button>
  `,
})
export class ButtonHeroTeachingsComponent {
  public characterId = input.required<CharacterId>();

  public open(): void {
    heroTeachingsModalOpen(this.characterId());
  }
}

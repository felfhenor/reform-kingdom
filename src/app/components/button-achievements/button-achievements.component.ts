import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModalAchievementsComponent } from '@components/modal-achievements/modal-achievements.component';
import { AnalyticsClickDirective } from '@directives/analytics-click.directive';
import { ModalOpenDirective } from '@directives/modal-open.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TeleportToDirective } from '@directives/teleport.to.directive';

@Component({
  selector: 'app-button-achievements',
  host: { class: 'w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AnalyticsClickDirective,
    ModalAchievementsComponent,
    ModalOpenDirective,
    SFXDirective,
    TeleportToDirective,
  ],
  template: `
    <button
      class="btn btn-neutral btn-block"
      appModalOpen="achievements"
      appAnalyticsClick="Meta:Achievements"
      appSfx="ui-click"
      [sfxTrigger]="['hover', 'click']"
    >
      Achievements
    </button>

    <div *appTeleportTo="'menu-achievements'">
      <app-modal-achievements />
    </div>
  `,
})
export class ButtonAchievementsComponent {}

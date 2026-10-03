import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { hotkeyMatches } from '@helpers/engine/hotkeys.ui';
import { kingdomSubviewClear } from '@helpers/engine/ui';
import { TippyDirective } from '@ngneat/helipopper';
import { HotkeysDirective } from '@ngneat/hotkeys';

@Component({
  selector: 'app-button-kingdom-back',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TippyDirective, HotkeysDirective, SFXDirective, IconComponent],
  template: `
    <button
      class="btn btn-sm btn-neutral btn-outline text-neutral-content"
      tp="Go Back [BACKSPACE]"
      (click)="back()"
      [hotkeys]="'BACKSPACE'"
      (hotkey)="hotkeyMatches($event, 'BACKSPACE') && back()"
      isGlobal
      appSfx="ui-error"
      [sfxOffset]="0"
      [sfxTrigger]="['click', 'hover']"
    >
      <app-icon name="tablerArrowLeft" class="text-lg" />
    </button>
  `,
})
export class ButtonKingdomBackComponent {
  protected hotkeyMatches = hotkeyMatches;

  public back(): void {
    kingdomSubviewClear();
  }
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { kingdomSubviewClear } from '@helpers/engine/ui';
import { hotkeyMatches } from '@helpers/engine/hotkeys';
import { TippyDirective } from '@ngneat/helipopper';
import { HotkeysDirective } from '@ngneat/hotkeys';

@Component({
  selector: 'app-button-kingdom-back',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TippyDirective, HotkeysDirective],
  template: `
    <button
      class="btn btn-sm btn-neutral btn-outline text-neutral-content"
      tp="Go Back [BACKSPACE]"
      (click)="back()"
      [hotkeys]="'BACKSPACE'"
      (hotkey)="hotkeyMatches($event, 'BACKSPACE') && back()"
      isGlobal
    >
      Back
    </button>
  `,
})
export class ButtonKingdomBackComponent {
  protected hotkeyMatches = hotkeyMatches;

  public back(): void {
    kingdomSubviewClear();
  }
}

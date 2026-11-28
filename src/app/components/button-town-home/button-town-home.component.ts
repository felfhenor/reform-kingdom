import { t } from '@helpers/i18n/i18n';
import { TPipe } from '@pipes/t.pipe';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { notifySuccess } from '@helpers/engine/notify';
import { canSetHomeNode, homeNodeGet } from '@helpers/town/town-spawn';
import { homeNodeSet } from '@helpers/town/town-spawn.ui';
import type { TownContent, WorldNodeEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-button-town-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isHomeNode()) {
      <div class="badge badge-data">
        <app-icon
          name="gameHouse"
          [tp]="'buttonTownHome.thisLocationIsYour' | t"
        ></app-icon>
      </div>
    } @else if (canSetHome()) {
      <button
        type="button"
        class="btn btn-neutral btn-outline btn-sm w-fit"
        (click)="setHome()"
        appSfx="ui-click"
        [sfxTrigger]="['click', 'hover']"
      >
        {{ 'buttonTownHome.setAsHome' | t }}
      </button>
    }
  `,
  imports: [TPipe, IconComponent, TippyDirective, SFXDirective],
})
export class ButtonTownHomeComponent {
  public entry = input.required<WorldNodeEntry>();
  public town = input.required<TownContent>();

  public isHomeNode = computed(
    () => homeNodeGet()?.nodeName === this.entry().nodeName,
  );

  public canSetHome = computed(
    () => !this.isHomeNode() && canSetHomeNode(this.entry()),
  );

  public setHome(): void {
    const town = this.town();
    void homeNodeSet(this.entry());
    notifySuccess(t('buttonTownHome.isNowYourHome', { name: town.name }));
  }
}

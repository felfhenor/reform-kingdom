import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
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
      <div class="badge badge-accent">
        <app-icon
          name="gameHouse"
          [tp]="'This location is your home. You will respawn here after dying, and your Decree will bring you here to heal if necessary.'"
        ></app-icon>
      </div>
    } @else if (canSetHome()) {
      <button
        type="button"
        class="btn btn-outline btn-accent btn-sm w-fit"
        (click)="setHome()"
      >
        Set as Home
      </button>
    }
  `,
  imports: [IconComponent, TippyDirective],
})
export class ButtonTownHomeComponent {
  public entry = input.required<WorldNodeEntry>();
  public town = input.required<TownContent>();

  public isHomeNode = computed(
    () => homeNodeGet()?.nodeName === this.entry().nodeName,
  );

  public canSetHome = computed(
    () => !this.isHomeNode() && canSetHomeNode(this.town().id),
  );

  public setHome(): void {
    const town = this.town();
    homeNodeSet(town.id);
    notifySuccess(`${town.name} is now your home.`);
  }
}

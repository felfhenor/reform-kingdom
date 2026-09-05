import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { notifySuccess } from '@helpers/engine/notify';
import {
  canSetHomeNode,
  homeNodeGet,
  homeNodeSet,
} from '@helpers/town/town-spawn';
import type { TownContent, WorldNodeEntry } from '@interfaces';

@Component({
  selector: 'app-button-town-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isHomeNode()) {
      <div class="badge badge-secondary">Home</div>
    } @else if (canSetHome()) {
      <button
        type="button"
        class="btn btn-outline btn-secondary btn-sm w-fit"
        (click)="setHome()"
      >
        Set as Home
      </button>
    }
  `,
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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { edictSeatBoons } from '@helpers/edict/edict';
import type { EdictContent } from '@interfaces';

@Component({
  selector: 'app-row-seat-boons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (seatBoons().length > 0) {
      <ul class="flex flex-col gap-2 text-sm">
        @for (seatBoon of seatBoons(); track seatBoon.id) {
          <li>
            <span class="font-bold">{{ seatBoon.name }}:</span>
            {{ seatBoon.description }}
          </li>
        }
      </ul>
    }
  `,
})
export class RowSeatBoonsComponent {
  public edict = input.required<EdictContent>();

  public seatBoons = computed(() => edictSeatBoons(this.edict()));
}

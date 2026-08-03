import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { pluralize } from '@boringnode/pluralize';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { TippyDirective } from '@ngneat/helipopper';
import { getEntry } from '../../helpers';
import type { ItemContent, ItemId } from '../../interfaces';

@Component({
  selector: 'app-currency-name',
  imports: [DecimalPipe, AtlasImageComponent, TippyDirective],
  host: {
    class: 'inline-flex gap-1 align-baseline',
  },
  template: `
    <div class="flex" [tp]="label()" [tpPlacement]="'bottom'">
      <div class="min-w-[16px] min-h-[16px]">
        <app-atlas-image
          class="absolute scale-[0.25] left-[-16px] top-[-18px]"
          spritesheet="item"
          [assetName]="icon()"
        />
      </div>

      @if (short()) {
        <span
          class="inline-block text-right tabular-nums"
          [style.min-width]="minWidth()"
        >
          {{ amount() | number: numberFormat() }}
        </span>
      } @else {
        <span>{{ label() }}</span>
      }
    </div>
  `,
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrencyNameComponent {
  public type = input.required<ItemId>();
  public short = input(false);
  public amount = input(0);
  public minWidth = input('');
  public numberFormat = input('1.0-0');

  public itemData = computed(() => getEntry<ItemContent>(this.type())!);
  public icon = computed(() => this.itemData().sprite);
  public label = computed(() => pluralize(this.itemData().name));
}

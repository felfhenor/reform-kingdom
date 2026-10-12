import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { FloatDeltaDirective } from '@directives/float-delta.directive';
import { getEntry } from '@helpers/content/content';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import {
  materialSourceIsCrafting,
  materialSourceNodeNames,
} from '@helpers/item/material-source.ui';
import type { ItemContent, ItemId } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { injectTweenedNumber } from '@services/animation.service';

@Component({
  selector: 'app-currency-name',
  imports: [
    DecimalPipe,
    AtlasImageComponent,
    DetailItemPreviewComponent,
    TippyDirective,
    FloatDeltaDirective,
  ],
  host: {
    class: 'inline-flex gap-2 align-baseline',
  },
  template: `
    <div
      class="flex items-center"
      [tp]="detailed() ? detailedTooltip : label()"
      [tpPlacement]="'bottom'"
    >
      <div class="min-w-[16px] min-h-[16px] mr-2">
        <app-atlas-image
          class="zoom-inline"
          spritesheet="item"
          [assetName]="icon()"
        />
      </div>

      @if (short()) {
        <span
          class="inline-block text-right tabular-nums relative"
          [style.min-width]="minWidth()"
          [appFloatDelta]="amount()"
          [appFloatDeltaEnabled]="animate()"
        >
          {{ displayAmount() | number: numberFormat() }}
        </span>
      } @else {
        <span>{{ label() }}</span>
      }
    </div>

    <ng-template #detailedTooltip>
      <app-detail-item-preview [display]="previewDisplay()">
        @if (sourceNodeNames().length > 0 || isCrafted()) {
          <div class="type-meta mt-2">
            @if (sourceNodeNames().length > 0) {
              <div>Found in: {{ sourceNodeNames().join(', ') }}</div>
            }
            @if (isCrafted()) {
              <div>Source: Crafting</div>
            }
          </div>
        }
      </app-detail-item-preview>
    </ng-template>
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
  public animate = input(false);
  public detailed = input(false);

  public itemData = computed(() => getEntry<ItemContent>(this.type())!);
  public icon = computed(() => this.itemData().sprite);
  public label = computed(() => this.itemData().name);
  public previewDisplay = computed(() =>
    itemPreviewDisplay('item', this.itemData()),
  );
  public isCrafted = computed(() => materialSourceIsCrafting(this.type()));
  public sourceNodeNames = computed(() => materialSourceNodeNames(this.type()));
  public displayAmount = injectTweenedNumber(
    () => this.amount(),
    () => this.animate(),
  );
}

import { DecimalPipe } from '@angular/common';
import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CurrencyNameComponent } from '@components/currency-name/currency-name.component';
import { RowSeatBoonsComponent } from '@components/row-seat-boons/row-seat-boons.component';
import { edictKindLabel } from '@helpers/edict/edict.ui';
import type { EdictContent } from '@interfaces';

@Component({
  selector: 'app-tooltip-edict',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CurrencyNameComponent,
    DecimalPipe,
    RowSeatBoonsComponent,
  ],
  host: { class: 'hidden' },
  template: `
    <ng-template #tooltipContent>
      @let e = edict();
      <div class="flex flex-row gap-4 p-2 max-w-[400px]">
        <div class="w-[64px] h-[64px] min-w-[64px] min-h-[64px] shrink-0">
          <app-atlas-image spritesheet="edict" [assetName]="e.sprite" />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex justify-between items-center gap-4">
            <span class="type-entity-name">{{ e.name }}</span>
            <span class="badge badge-sm badge-data tabular-nums min-w-[24px]">
              {{ e.fragments > 0 ? '+' : '' }}{{ e.fragments | number }}
            </span>
          </div>

          <p>{{ e.description }}</p>

          <app-row-seat-boons [edict]="e" />

          @if (e.startingItems?.length) {
            <ul class="flex flex-col gap-2 text-sm">
              @for (item of e.startingItems; track $index) {
                <li class="flex items-center gap-2">
                  <span class="tabular-nums">
                    +{{ item.quantity | number }}
                  </span>
                  <app-currency-name [type]="item.itemId" />
                </li>
              }
            </ul>
          }
          <p class="type-meta">
            {{ kindLabel() }} · {{ cleared() ? 'Completed' : 'Incomplete' }}
          </p>

          @if (blocked()) {
            <p class="type-blocker">
              Can't be picked with your current edicts.
            </p>
          }
        </div>
      </div>
    </ng-template>
  `,
})
export class TooltipEdictComponent {
  public edict = input.required<EdictContent>();
  public blocked = input(false);
  public cleared = input(false);

  public kindLabel = computed(() => edictKindLabel(this.edict().kind));

  public template = viewChild.required<TemplateRef<unknown>>('tooltipContent');
}

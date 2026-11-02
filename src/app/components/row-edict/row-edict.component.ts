import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import type { EdictContent } from '@interfaces';

@Component({
  selector: 'app-row-edict',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AtlasImageComponent, DecimalPipe],
  host: { class: 'flex items-start gap-2 py-1' },
  template: `
    @let e = edict();
    <app-atlas-image
      class="zoom-row shrink-0"
      spritesheet="edict"
      [assetName]="e.sprite"
    />
    <div class="flex-1 min-w-0">
      <div class="font-bold">{{ e.name }}</div>
      <div class="type-muted text-sm">{{ e.description }}</div>
    </div>
    <span class="badge badge-sm badge-data tabular-nums shrink-0">
      {{ e.fragments > 0 ? '+' : '' }}{{ e.fragments | number }}
    </span>
  `,
})
export class RowEdictComponent {
  public edict = input.required<EdictContent>();
}

import { TPipe } from '@pipes/t.pipe';
import { FFFocusRowDirective } from '@/app/ff/focus/ff-focus-row.directive';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { RowSeatBoonsComponent } from '@components/row-seat-boons/row-seat-boons.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import {
  edictScoreMultiplier,
  edictsActive,
  edictsFragmentTotal,
} from '@helpers/edict/edict';
import { edictKindLabel } from '@helpers/edict/edict.ui';
import type { EdictKind } from '@interfaces';

@Component({
  selector: 'app-play-kingdom-edicts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    BlankSlateComponent,
    ButtonKingdomBackComponent,
    CardPageComponent,
    DecimalPipe,
    AtlasImageComponent,
    RowSeatBoonsComponent,
    SlotIconBlankComponent,
    FFFocusRowDirective,
  ],
  template: `
    <app-card-page heightProfile="full">
      <span header>{{ 'playKingdomEdicts.edicts' | t }}</span>

      <app-button-kingdom-back pageactions />

      @let edicts = activeEdicts();
      @if (edicts.length > 0) {
        <span pageactionssecondary class="badge badge-data tabular-nums">
          {{
            'playKingdomEdicts.fragmentsScore'
              | t
                : {
                    fragmentTotal: (fragmentTotal() | number),
                    scoreMultiplier: (scoreMultiplier() | number: '1.0-2'),
                  }
          }}
        </span>
      }

      <div class="flex flex-col gap-2 h-full overflow-y-auto pb-2">
        @for (edict of edicts; track edict.id) {
          <div
            ffFocusRow
            class="flex items-center gap-4 p-2 bg-base-200 shrink-0"
          >
            <app-slot-icon-blank class="shrink-0">
              <app-atlas-image spritesheet="edict" [assetName]="edict.sprite" />
            </app-slot-icon-blank>

            <div class="flex-1 flex flex-col gap-2 min-w-0">
              <span class="type-entity-name">{{ edict.name }}</span>
              <span class="type-meta">{{ edict.description }}</span>
              <app-row-seat-boons [edict]="edict" />
            </div>

            <div class="flex flex-col items-end gap-2 shrink-0">
              <span class="badge badge-sm badge-data tabular-nums">
                {{
                  'playKingdomEdicts.fragments'
                    | t
                      : {
                          fragments: edict.fragments > 0 ? '+' : '',
                          fragments2: (edict.fragments | number),
                        }
                }}
              </span>
              <span class="type-meta">{{ kindLabel(edict.kind) }}</span>
            </div>
          </div>
        } @empty {
          <app-blank-slate size="page">
            {{ 'playKingdomEdicts.thisRunHasNo' | t }}
          </app-blank-slate>
        }
      </div>
    </app-card-page>
  `,
})
export class PlayKingdomEdictsComponent {
  public activeEdicts = computed(() => edictsActive());
  public fragmentTotal = computed(() =>
    edictsFragmentTotal(this.activeEdicts()),
  );
  public scoreMultiplier = computed(() =>
    edictScoreMultiplier(this.fragmentTotal()),
  );

  public kindLabel(kind: EdictKind): string {
    return edictKindLabel(kind);
  }
}

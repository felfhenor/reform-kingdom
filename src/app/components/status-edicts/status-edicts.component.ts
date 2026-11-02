import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconKingdomComponent } from '@components/icon-kingdom/icon-kingdom.component';
import { edictsActive } from '@helpers/edict/edict';
import { edictsFragmentTotal } from '@helpers/edict/edict.ui';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-status-edicts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconKingdomComponent, AtlasImageComponent, TippyDirective],
  template: `
    @let edicts = activeEdicts();
    @if (edicts.length > 0) {
      <ng-template #edictsTooltip>
        <div class="p-2 max-w-[400px]">
          <div class="flex justify-between items-center gap-4 mb-2">
            <span class="type-entity-name">Edicts</span>
          </div>

          <div class="flex flex-col gap-2">
            @for (edict of edicts; track edict.id) {
              <div class="flex items-center gap-2">
                <app-atlas-image
                  class="zoom-inline shrink-0"
                  spritesheet="edict"
                  [assetName]="edict.sprite"
                />

                {{ edict.name }}
              </div>
            }
          </div>
        </div>
      </ng-template>

      <div
        class="w-16 h-16 m-2 flex items-center justify-center border border-current"
        [tp]="edictsTooltip"
        [tpPlacement]="'bottom'"
        [attr.aria-label]="'Edicts'"
        (animate.enter)="onEnter($event)"
      >
        <app-icon-kingdom name="edicts" />
      </div>
    }
  `,
})
export class StatusEdictsComponent {
  private anim = inject(AnimationService);

  public activeEdicts = computed(() => edictsActive());
  public fragmentTotal = computed(() =>
    edictsFragmentTotal(this.activeEdicts()),
  );

  public onEnter(event: AnimationCallbackEvent): void {
    this.anim.popIn(event.target);
  }
}

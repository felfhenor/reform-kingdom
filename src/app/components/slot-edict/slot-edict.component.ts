import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { TooltipEdictComponent } from '@components/tooltip-edict/tooltip-edict.component';
import { SFXDirective } from '@directives/sfx.directive';
import { edictShortName } from '@helpers/edict/edict.ui';
import type { EdictContent } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-edict',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    NgTemplateOutlet,
    SFXDirective,
    TippyDirective,
    TooltipEdictComponent,
  ],
  template: `
    @let e = edict();
    <app-tooltip-edict
      #tooltip
      [edict]="e"
      [blocked]="blocked()"
      [cleared]="cleared()"
    />

    <ng-template #tile>
      <span
        class="h-[64px] w-[64px] flex justify-center items-center bg-gray-400"
        [class.node-outline]="!picked() && !cleared() && !blocked()"
        [class.ring-2]="picked()"
        [class.ring-primary]="picked()"
        [class.node-cleared]="!picked() && cleared()"
        [class.node-excluded]="blocked()"
      >
        <app-atlas-image spritesheet="edict" [assetName]="e.sprite" />
      </span>
      <span class="text-xs leading-tight text-center w-full">
        {{ shortName() }}
      </span>
    </ng-template>

    @if (interactive()) {
      <button
        type="button"
        class="flex flex-col items-center gap-2 w-[72px]"
        [class.cursor-pointer]="!blocked()"
        [class.cursor-not-allowed]="blocked()"
        [attr.aria-disabled]="blocked()"
        [attr.aria-pressed]="picked()"
        [attr.aria-label]="e.name"
        [tp]="tooltip.template()"
        (click)="toggled.emit()"
        [appSfx]="blocked() ? 'ui-error' : 'ui-click'"
        [sfxTrigger]="['click', 'hover']"
      >
        <ng-container [ngTemplateOutlet]="tile" />
      </button>
    } @else {
      <div
        class="flex flex-col items-center gap-2 w-[72px]"
        [tp]="tooltip.template()"
      >
        <ng-container [ngTemplateOutlet]="tile" />
      </div>
    }
  `,
})
export class SlotEdictComponent {
  public edict = input.required<EdictContent>();
  public picked = input(false);
  public blocked = input(false);
  public cleared = input(false);
  public interactive = input(false);

  public toggled = output<void>();

  public shortName = computed(() => edictShortName(this.edict()));
}

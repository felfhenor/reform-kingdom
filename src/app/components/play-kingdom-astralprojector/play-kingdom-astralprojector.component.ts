import { DecimalPipe, formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { getEntry } from '@helpers/content';
import { formatDuration } from '@helpers/engine/timer';
import {
  astralProjectorCast,
  astralProjectorMaterialEntries,
  astralProjectorSpellToBeOverwritten,
  isAstralProjectorCastable,
  unlockedAstralProjectorEntries,
} from '@helpers/kingdom/astral-projector';
import type {
  AstralProjectorContent,
  AstralProjectorId,
  AstralProjectorMaterialEntry,
  GlobalEffectContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { notifySuccess } from '@helpers/engine/notify';

type AstralProjectorRowViewModel = {
  content: AstralProjectorContent;
  effect: GlobalEffectContent | undefined;
  materialEntries: AstralProjectorMaterialEntry[];
  castable: boolean;
  durationLabel: string;
};

@Component({
  selector: 'app-play-kingdom-astralprojector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    ButtonKingdomBackComponent,
    CardPageComponent,
    DecimalPipe,
    IconUnknownComponent,
    SlotIconBlankComponent,
    SweetAlert2Module,
    TippyDirective,
  ],
  templateUrl: './play-kingdom-astralprojector.component.html',
})
export class PlayKingdomAstralProjectorComponent {
  private locale = inject(LOCALE_ID);

  public rows = computed<AstralProjectorRowViewModel[]>(() =>
    unlockedAstralProjectorEntries().map((content) => ({
      content,
      effect: getEntry<GlobalEffectContent>(content.globalEffectId),
      materialEntries: astralProjectorMaterialEntries(content),
      castable: isAstralProjectorCastable(content),
      durationLabel: formatDuration(content.duration),
    })),
  );

  private overwriteSwal = viewChild<SwalComponent>('overwriteSwal');
  private pendingCastId = signal<AstralProjectorId | undefined>(undefined);
  public overwriteTargetName = signal<string | undefined>(undefined);

  public onCastClick(content: AstralProjectorContent): void {
    const overwritten = astralProjectorSpellToBeOverwritten(content.id);

    if (overwritten) {
      this.pendingCastId.set(content.id);
      this.overwriteTargetName.set(overwritten.name);
      this.overwriteSwal()?.fire();
      return;
    }

    astralProjectorCast(content.id);

    notifySuccess(`You've cast ${content?.name ?? 'a spell'}!`);
  }

  public confirmCast(): void {
    const id = this.pendingCastId();
    if (!id) return;

    const content = getEntry<AstralProjectorContent>(id);

    astralProjectorCast(id);
    this.pendingCastId.set(undefined);

    notifySuccess(`You've cast ${content?.name ?? 'a spell'}!`);
  }

  public materialTooltip(entry: AstralProjectorMaterialEntry): string {
    if (!entry.discovered) return 'A material yet to be discovered.';

    const owned = formatNumber(entry.owned, this.locale);
    const quantity = formatNumber(entry.quantity, this.locale);
    return `${entry.content?.name ?? 'Unknown'} (${owned}/${quantity})`;
  }
}

import { DecimalPipe, formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import {
  bestiaryEntryLevels,
  bestiarySourceNodeNamesAtLevel,
  bestiaryXpLabel,
} from '@helpers/kingdom/bestiary.ui';
import type { BestiaryEntry } from '@interfaces';

@Component({
  selector: 'app-detail-monster-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasAnimationComponent,
    DecimalPipe,
    IconUnknownComponent,
    SlotIconBlankComponent,
  ],
  templateUrl: './detail-monster-summary.component.html',
})
export class DetailMonsterSummaryComponent {
  public entry = input.required<BestiaryEntry>();
  // Narrows "Found in" to that level and adds its XP; without it, every spawn location.
  public level = input<number>();
  // Off where the player is already looking at the location, e.g. a node's monster list.
  public showLocations = input(true);

  private locale = inject(LOCALE_ID);
  private format = (value: number) => formatNumber(value, this.locale);

  // Monsters outside any encounter (summons, guardians) have no range, so fall back to the given level.
  public levelLabel = computed(() => {
    const levels = bestiaryEntryLevels(this.entry());
    const level = this.level();
    if (levels.length > 0) {
      return `Lv. ${this.format(levels[0])}-${this.format(levels.at(-1)!)}`;
    }
    return level === undefined ? '' : `Lv. ${this.format(level)}`;
  });

  public foundIn = computed(() =>
    bestiarySourceNodeNamesAtLevel(this.entry(), this.level()),
  );

  public xpLabel = computed(() => {
    const level = this.level();
    return level === undefined
      ? undefined
      : bestiaryXpLabel(this.entry().monster, level);
  });
}

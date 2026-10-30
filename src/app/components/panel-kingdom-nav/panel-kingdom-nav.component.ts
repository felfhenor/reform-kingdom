import { formatNumber } from '@angular/common';
import type { AnimationCallbackEvent } from '@angular/core';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconKingdomComponent } from '@components/icon-kingdom/icon-kingdom.component';
import { SFXDirective } from '@directives/sfx.directive';
import { craftQueueTicksRemaining } from '@helpers/crafting/crafting';
import { craftQueueUnitsRemaining } from '@helpers/crafting/crafting.ui';
import { tradeskillBuilding } from '@helpers/crafting/tradeskill';
import { formatDuration } from '@helpers/engine/timer';
import {
  kingdomSubview,
  kingdomSubviewClear,
  kingdomSubviewShow,
  uiClockTick,
} from '@helpers/engine/ui';
import { armoryCap, armoryGet } from '@helpers/kingdom/armory';
import { armoryStatusDotClass } from '@helpers/kingdom/armory.ui';
import { kingdomNavSections } from '@helpers/kingdom/kingdom-nav.ui';
import type { KingdomNavEntry, KingdomNavGroup, Tradeskill } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-panel-kingdom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconKingdomComponent,
    SFXDirective,
    TippyDirective,
  ],
  templateUrl: './panel-kingdom-nav.component.html',
})
export class PanelKingdomNavComponent {
  private locale = inject(LOCALE_ID);
  private anim = inject(AnimationService);

  // Only icons unlocked while the rail is on screen animate, not the initial set.
  private hasRendered = false;

  constructor() {
    afterNextRender(() => (this.hasRendered = true));
  }

  public kingdomSubviewShow = kingdomSubviewShow;
  public kingdomSubviewClear = kingdomSubviewClear;

  public kingdomSubview = kingdomSubview;

  // Literal class names so Tailwind's scanner picks them up.
  public dividerClass: Record<KingdomNavGroup, string> = {
    reserves: 'divider-section-reserves',
    collections: 'divider-section-collections',
    workforce: 'divider-section-workforce',
    crafting: 'divider-section-crafting',
    actions: '',
  };

  // Ticks once a second so tradeskill queue tooltips never look frozen.
  public sections = computed(() => {
    uiClockTick();

    return kingdomNavSections().map((section) => ({
      group: section.group,
      items: section.entries.map((entry) => ({
        entry,
        isIdle: this.isTradeskillIdle(entry),
        statusDotClass: this.statusDotClass(entry),
        tooltip: this.tooltip(entry),
      })),
    }));
  });

  public onEntryEnter(event: AnimationCallbackEvent): void {
    if (this.hasRendered) this.anim.fadeIn(event.target);
  }

  private isTradeskillIdle(entry: KingdomNavEntry): boolean {
    return (
      entry.kind === 'tradeskill' &&
      tradeskillBuilding(entry.tradeskill).queue.length === 0
    );
  }

  private statusDotClass(entry: KingdomNavEntry): string | undefined {
    return entry.subview === 'armory'
      ? armoryStatusDotClass(armoryGet().length, armoryCap())
      : undefined;
  }

  private tooltip(entry: KingdomNavEntry): string {
    return entry.kind === 'tradeskill'
      ? this.tradeskillTooltip(entry.label, entry.tradeskill)
      : entry.label;
  }

  private tradeskillTooltip(label: string, tradeskill: Tradeskill): string {
    const building = tradeskillBuilding(tradeskill);
    const level = formatNumber(building.level, this.locale);
    if (building.queue.length === 0) return `${label} Lv. ${level} (idle)`;

    const units = formatNumber(
      craftQueueUnitsRemaining(tradeskill),
      this.locale,
    );
    const remaining = formatDuration(craftQueueTicksRemaining(tradeskill));
    return `${label} Lv. ${level} (${units} items crafting, ${remaining} remaining)`;
  }
}

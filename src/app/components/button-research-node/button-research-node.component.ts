import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { IconComponent } from '@components/icon/icon.component';
import { getEntry } from '@helpers/content';
import { goldCoinId } from '@helpers/materials';
import { researchEffectDescription } from '@helpers/research/research-effect-description';
import { researchPointItemId } from '@helpers/research/research-content';
import type { ResearchContent, ResearchId, ResearchTreeLayoutCell } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-button-research-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyCostComponent, IconComponent, TippyDirective],
  templateUrl: './button-research-node.component.html',
})
export class ButtonResearchNodeComponent {
  private locale = inject(LOCALE_ID);

  public cell = input.required<ResearchTreeLayoutCell>();
  public researchSelect = output<ResearchId>();

  public researchPointItemId = researchPointItemId;
  public goldCoinId = goldCoinId;

  public prerequisiteLabel = computed(() => {
    const names = this.cell()
      .content.prerequisiteResearchIds.map(
        (id) => getEntry<ResearchContent>(id)?.name,
      )
      .filter((name): name is string => !!name);

    return names.length > 0 ? `req. ${names.join(', ')}` : undefined;
  });

  public effectDescription = computed(() => {
    const { effect } = this.cell().content;
    if (!effect) return undefined;

    return researchEffectDescription(effect, (value) =>
      formatNumber(value, this.locale),
    );
  });

  // Locked, or Available but not currently affordable - deliberately
  // excludes Completed/Active, whose `affordable` field is still computed
  // (researchTreeLayout doesn't special-case it) but is irrelevant once a
  // node is already completed or in progress; dimming it there would read
  // as "something's wrong with this node" rather than "you can't afford
  // this yet".
  public isDimmed = computed(() => {
    const node = this.cell();
    return (
      node.state === 'Locked' || (node.state === 'Available' && !node.affordable)
    );
  });

  public costSummary = computed(() => {
    const { cost } = this.cell().content;
    const rpItem = getEntry(this.researchPointItemId());
    const parts = [
      `${formatNumber(cost.rp, this.locale)} ${rpItem?.name ?? 'Unknown'}`,
      `${formatNumber(cost.gold, this.locale)} gold`,
    ];
    cost.materials.forEach((material) => {
      const item = getEntry(material.itemId);
      parts.push(
        `${formatNumber(material.quantity, this.locale)} ${item?.name ?? 'Unknown'}`,
      );
    });
    if (cost.collectibleId) {
      parts.push(`requires ${getEntry(cost.collectibleId)?.name ?? 'Unknown'}`);
    }
    return parts.join(', ');
  });

  // Deliberately not bound to the button's native `disabled` attribute - a
  // disabled button in most browsers fires no mouse events at all, which
  // would block the effect/cost tooltip from ever showing on a Locked or
  // unaffordable node (exactly the nodes a player most needs the tooltip
  // for). Dimming is handled with `text-lighter`/`opacity-50` in the
  // template instead, and this guard keeps a click on those nodes a no-op.
  public isClickable = computed(() => {
    const node = this.cell();
    return node.state === 'Available' && node.affordable;
  });

  public onClick(): void {
    if (!this.isClickable()) return;
    this.researchSelect.emit(this.cell().content.id);
  }
}

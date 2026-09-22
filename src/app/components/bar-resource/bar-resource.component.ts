import type { AnimationCallbackEvent } from '@angular/core';
import { Component, computed, inject } from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { getEntry } from '@helpers/content/content';
import {
  getMaterialQuantity,
  isMaterialDiscovered,
} from '@helpers/item/materials';
import type { ItemContent } from '@interfaces';
import { AnimationService } from '@services/animation.service';

@Component({
  selector: 'app-bar-resource',
  imports: [CurrencyCostComponent],
  templateUrl: './bar-resource.component.html',
})
export class BarResourceComponent {
  private anim = inject(AnimationService);

  public resources = computed(() => {
    const goldCoinEntry = getEntry<ItemContent>('Gold Coin')!;
    const crimsonLucre = getEntry<ItemContent>('Crimson Lucre')!;

    return [
      { itemRef: goldCoinEntry, total: getMaterialQuantity(goldCoinEntry.id) },
      { itemRef: crimsonLucre, total: getMaterialQuantity(crimsonLucre.id) },
    ].filter((r) => isMaterialDiscovered(r.itemRef.id));
  });

  public areAnyGreaterThanZero = computed(() => {
    return this.resources().some((r) => r.total > 0);
  });

  public onEnter(event: AnimationCallbackEvent): void {
    this.anim.popIn(event.target);
  }

  public onLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import {
  getEntry,
  isCollectibleDiscovered,
  isEquipmentDiscovered,
  isMaterialDiscovered,
} from '@helpers';
import type {
  CollectibleContent,
  DropRarity,
  DroppedReward,
  EquipmentContent,
  ItemContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

type RewardContent = {
  name: string;
  description: string;
  sprite: string;
  rarity: DropRarity;
};

@Component({
  selector: 'app-completion-reward-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconBlankSlotComponent,
    IconUnknownComponent,
    TippyDirective,
  ],
  templateUrl: './completion-reward-slot.component.html',
  styleUrl: './completion-reward-slot.component.scss',
})
export class CompletionRewardSlotComponent {
  public reward = input.required<DroppedReward>();

  public spritesheet = computed<'item' | 'equipment' | 'collectible'>(() => {
    const reward = this.reward();
    if ('itemId' in reward) return 'item';
    if ('equipmentId' in reward) return 'equipment';
    return 'collectible';
  });

  public content = computed<RewardContent | undefined>(() => {
    const reward = this.reward();
    if ('itemId' in reward) return getEntry<ItemContent>(reward.itemId);
    if ('equipmentId' in reward) {
      return getEntry<EquipmentContent>(reward.equipmentId);
    }
    return getEntry<CollectibleContent>(reward.collectibleId);
  });

  public isDiscovered = computed(() => {
    const reward = this.reward();
    if ('itemId' in reward) return isMaterialDiscovered(reward.itemId);
    if ('equipmentId' in reward) {
      return isEquipmentDiscovered(reward.equipmentId);
    }
    return isCollectibleDiscovered(reward.collectibleId);
  });
}

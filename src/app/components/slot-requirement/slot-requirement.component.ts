import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import type { AtlasedImage, HasRarity, HasSprite } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-requirement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlotRarityOutlineComponent, IconUnknownComponent, TippyDirective],
  templateUrl: './slot-requirement.component.html',
  host: { class: 'block relative w-8 h-8 shrink-0' },
})
export class SlotRequirementComponent {
  public content = input<HasRarity & HasSprite>();
  public spritesheet = input.required<AtlasedImage>();
  public owned = input.required<number>();
  public quantity = input.required<number>();
  public tooltip = input.required<string>();
}

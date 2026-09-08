import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  input,
} from '@angular/core';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import type { AtlasedImage, HasRarity, HasSprite } from '@interfaces';

@Component({
  selector: 'app-slot-rarity-outline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlotIconBlankComponent, IconItemPreviewComponent],
  templateUrl: './slot-rarity-outline.component.html',
  styleUrl: './slot-rarity-outline.component.scss',
})
export class SlotRarityOutlineComponent {
  public entry = input.required<HasRarity & HasSprite>();
  public spritesheet = input.required<AtlasedImage>();
  public isAnimated = input<boolean>(false);
  public backdropSprite = input<string>();

  @HostBinding('class')
  public get classList() {
    return `outline-2 rounded ${this.entry() ? `outline-${this.entry().rarity}` : 'outline-gray-500'}`;
  }
}

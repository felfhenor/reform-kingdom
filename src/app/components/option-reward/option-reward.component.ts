import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import type { RewardContentInfo } from '@interfaces';

@Component({
  selector: 'app-option-reward',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2' },
  imports: [AtlasImageComponent, SlotIconBlankComponent],
  template: `
    <app-slot-icon-blank class="zoom-row">
      <app-atlas-image
        [spritesheet]="reward().spritesheet"
        [assetName]="reward().sprite"
      />
    </app-slot-icon-blank>
    <span>{{ reward().name }}</span>
  `,
})
export class OptionRewardComponent {
  public reward = input.required<RewardContentInfo>();
}

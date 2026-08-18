import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import type { RewardContentInfo } from '@interfaces';

// Icon + name row for a resolved reward, shared by any dropdown option needing to show a reward's identity.
@Component({
  selector: 'app-option-reward',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2' },
  imports: [AtlasImageComponent],
  template: `
    <app-atlas-image
      class="zoom-row"
      [spritesheet]="reward().spritesheet"
      [assetName]="reward().sprite"
    />
    <span>{{ reward().name }}</span>
  `,
})
export class OptionRewardComponent {
  public reward = input.required<RewardContentInfo>();
}

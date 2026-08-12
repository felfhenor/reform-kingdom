import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import type { RewardContentInfo } from '@interfaces';

// An icon + name row for a resolved reward - shared by any item-selector
// dropdown option that needs to show a reward's identity (e.g. the Farm
// Node clause's reward picker), rather than re-rendering the icon/name pair
// ad-hoc in each option template.
@Component({
  selector: 'app-reward-option',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2' },
  imports: [AtlasImageComponent],
  template: `
    <app-atlas-image
      class="zoom-50"
      [spritesheet]="reward().spritesheet"
      [assetName]="reward().sprite"
    />
    <span>{{ reward().name }}</span>
  `,
})
export class RewardOptionComponent {
  public reward = input.required<RewardContentInfo>();
}

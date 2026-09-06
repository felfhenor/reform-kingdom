import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { ModalComponent } from '@components/modal/modal.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { formatDuration } from '@helpers/engine/timer';
import { travelStart } from '@helpers/hero/travel';
import { raidDefenseRowViewModels } from '@helpers/town/raid/town-raid-defense';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-modal-raid-defense',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalComponent,
    AtlasAnimationComponent,
    SlotIconBlankComponent,
    TippyDirective,
  ],
  templateUrl: './modal-raid-defense.component.html',
  styleUrl: './modal-raid-defense.component.scss',
})
export class ModalRaidDefenseComponent {
  public rows = computed(() => raidDefenseRowViewModels());

  public etaLabel(seconds: number): string {
    return formatDuration(seconds);
  }

  public travelTo(nodeName: string): void {
    travelStart(nodeName);
  }
}

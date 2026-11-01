import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { ModalComponent } from '@components/modal/modal.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { SFXDirective } from '@directives/sfx.directive';
import { modalIsOpen } from '@helpers/engine/modal-stack';
import { formatDuration } from '@helpers/engine/timer';
import { travelStart } from '@helpers/hero/travel';
import { rumorCatalogRowViewModels } from '@helpers/rumor/rumor.ui';

@Component({
  selector: 'app-modal-rumors',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconUnknownComponent,
    ModalComponent,
    SFXDirective,
    SlotRarityOutlineComponent,
    SpriteNodeComponent,
  ],
  templateUrl: './modal-rumors.component.html',
})
export class ModalRumorsComponent {
  // Always mounted, so skip per-row pathing while closed.
  public rows = computed(() =>
    modalIsOpen('rumors') ? rumorCatalogRowViewModels() : [],
  );

  public etaLabel(seconds: number): string {
    return formatDuration(seconds);
  }

  public travelTo(nodeName: string): void {
    travelStart(nodeName);
  }
}

import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ButtonTravelHereComponent } from '@components/button-travel-here/button-travel-here.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { ModalComponent } from '@components/modal/modal.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { modalIsOpen } from '@helpers/engine/modal-stack';
import { rumorCatalogRowViewModels } from '@helpers/rumor/rumor.ui';

@Component({
  selector: 'app-modal-rumors',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonTravelHereComponent,
    IconUnknownComponent,
    ModalComponent,
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
}

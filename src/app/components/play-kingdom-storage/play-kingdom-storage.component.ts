import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { PagePagedGridComponent } from '@components/page-paged-grid/page-paged-grid.component';
import { SlotStorageItemComponent } from '@components/slot-storage-item/slot-storage-item.component';
import {
  filterStorageMaterials,
  getStorageMaterials,
} from '@helpers/kingdom/storage';

@Component({
  selector: 'app-play-kingdom-storage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PagePagedGridComponent, SlotStorageItemComponent],
  templateUrl: './play-kingdom-storage.component.html',
  styleUrl: './play-kingdom-storage.component.scss',
})
export class PlayKingdomStorageComponent {
  public materials = computed(() => getStorageMaterials());
  public filterFn = filterStorageMaterials;
}

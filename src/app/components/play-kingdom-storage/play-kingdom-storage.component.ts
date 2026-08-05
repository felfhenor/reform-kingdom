import {
  ChangeDetectionStrategy,
  Component,
  computed,
} from '@angular/core';
import { PagedGridPageComponent } from '@components/paged-grid-page/paged-grid-page.component';
import { StorageItemSlotComponent } from '@components/storage-item-slot/storage-item-slot.component';
import { filterStorageMaterials, getStorageMaterials } from '@helpers';

@Component({
  selector: 'app-play-kingdom-storage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PagedGridPageComponent, StorageItemSlotComponent],
  templateUrl: './play-kingdom-storage.component.html',
  styleUrl: './play-kingdom-storage.component.scss',
})
export class PlayKingdomStorageComponent {
  public materials = computed(() => getStorageMaterials());
  public filterFn = filterStorageMaterials;
}

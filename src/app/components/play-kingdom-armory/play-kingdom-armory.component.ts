import {
  ChangeDetectionStrategy,
  Component,
  computed,
} from '@angular/core';
import { ArmoryItemSlotComponent } from '@components/armory-item-slot/armory-item-slot.component';
import { PagedGridPageComponent } from '@components/paged-grid-page/paged-grid-page.component';
import { filterArmoryEntries, getArmoryEntries } from '@helpers';

@Component({
  selector: 'app-play-kingdom-armory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ArmoryItemSlotComponent, PagedGridPageComponent],
  templateUrl: './play-kingdom-armory.component.html',
  styleUrl: './play-kingdom-armory.component.scss',
})
export class PlayKingdomArmoryComponent {
  public entries = computed(() => getArmoryEntries());
  public filterFn = filterArmoryEntries;
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { MuseumCollectibleSlotComponent } from '@components/museum-collectible-slot/museum-collectible-slot.component';
import { PagedGridPageComponent } from '@components/paged-grid-page/paged-grid-page.component';
import { filterMuseumCollectibleEntries, getMuseumCollectibleEntries } from '@helpers';
import type { MuseumCollectibleEntry, MuseumTab } from '@interfaces';

@Component({
  selector: 'app-play-kingdom-museum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MuseumCollectibleSlotComponent, PagedGridPageComponent],
  templateUrl: './play-kingdom-museum.component.html',
  styleUrl: './play-kingdom-museum.component.scss',
})
export class PlayKingdomMuseumComponent {
  private grid =
    viewChild<PagedGridPageComponent<MuseumCollectibleEntry>>('grid');

  public activeTab = signal<MuseumTab>('collectibles');

  public entries = computed(() => getMuseumCollectibleEntries());
  public filterFn = filterMuseumCollectibleEntries;

  public discoveredCount = computed(
    () => this.entries().filter((entry) => entry.discovered).length,
  );

  public setTab(tab: MuseumTab): void {
    this.activeTab.set(tab);
    this.grid()?.resetPage();
  }
}

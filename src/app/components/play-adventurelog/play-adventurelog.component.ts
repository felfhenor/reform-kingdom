import type { AnimationCallbackEvent, ElementRef } from '@angular/core';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { AdventureLogMessageComponent } from '@components/adventure-log-message/adventure-log-message.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { combatLog } from '@helpers/combat/combat-log';
import { adventureLogTimestampTooltip } from '@helpers/combat/combat-log.ui';
import {
  ADVENTURE_LOG_LOAD_MORE_THRESHOLD_PX,
  ADVENTURE_LOG_PAGE_SIZE,
} from '@helpers/config';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';
import { TimeagoPipe } from 'ngx-timeago';

@Component({
  selector: 'app-play-adventurelog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdventureLogMessageComponent,
    BlankSlateComponent,
    CardPageComponent,
    TimeagoPipe,
    TippyDirective,
  ],
  templateUrl: './play-adventurelog.component.html',
})
export class PlayAdventureLogComponent {
  private anim = inject(AnimationService);
  private destroyRef = inject(DestroyRef);

  private scrollContainer =
    viewChild.required<ElementRef<HTMLElement>>('scrollContainer');
  private loadMoreSentinel =
    viewChild.required<ElementRef<HTMLElement>>('loadMoreSentinel');
  private loadMoreObserver?: IntersectionObserver;

  public searchText = signal<string>('');

  // Snapshot of entries already present on open, so loading history doesn't replay hundreds of enter animations at once - only genuinely new entries animate in.
  private initialEntryIds = new Set(
    combatLog()
      .filter((entry) => entry.message.trim() !== '')
      .map((entry) => entry.messageId),
  );

  public entries = computed(() =>
    combatLog().filter((entry) => entry.message.trim() !== ''),
  );

  public visibleEntries = computed(() => {
    const search = this.searchText().toLowerCase();
    return this.entries().filter(
      (e) =>
        e.message.toLowerCase().includes(search) ||
        e.locationName.toLowerCase().includes(search),
    );
  });

  // Resets to one page whenever the search changes, since the old depth is meaningless for new results.
  private renderLimit = linkedSignal({
    source: this.searchText,
    computation: () => ADVENTURE_LOG_PAGE_SIZE,
  });

  public renderedEntries = computed(() =>
    this.visibleEntries().slice(0, this.renderLimit()),
  );

  public timestampTooltip = adventureLogTimestampTooltip;

  public onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.loadMoreObserver?.disconnect());

    // Re-observing fires a fresh intersection check, so a container still not full after a page renders keeps loading.
    afterRenderEffect(() => {
      this.renderedEntries();
      const sentinel = this.loadMoreSentinel().nativeElement;
      this.loadMoreObserver ??= this.createLoadMoreObserver();
      this.loadMoreObserver.unobserve(sentinel);
      this.loadMoreObserver.observe(sentinel);
    });
  }

  private createLoadMoreObserver(): IntersectionObserver {
    return new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) this.loadMore();
      },
      {
        root: this.scrollContainer().nativeElement,
        rootMargin: `0px 0px ${ADVENTURE_LOG_LOAD_MORE_THRESHOLD_PX}px 0px`,
      },
    );
  }

  private loadMore(): void {
    if (this.renderLimit() >= this.visibleEntries().length) return;
    this.renderLimit.update((limit) => limit + ADVENTURE_LOG_PAGE_SIZE);
  }

  public onEnter(event: AnimationCallbackEvent, messageId: string): void {
    if (this.initialEntryIds.has(messageId)) return;
    this.anim.slideIn(event.target);
  }

  public onLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }
}

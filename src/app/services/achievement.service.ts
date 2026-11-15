import { Injectable, signal } from '@angular/core';
import {
  achievementCards,
  achievementsAnnounceLog,
} from '@helpers/achievement/achievement-announce.ui';
import { achievementsAnnounced$ } from '@helpers/achievement/achievement-unlock';
import type { AchievementCard } from '@interfaces';

@Injectable({
  providedIn: 'root',
})
export class AchievementService {
  private queue = signal<AchievementCard[]>([]);
  public hasQueued = () => this.queue().length > 0;

  init() {
    achievementsAnnounced$.subscribe((announcement) => {
      achievementsAnnounceLog(announcement);
      const cards = achievementCards(announcement);
      this.queue.update((queue) => [...queue, ...cards]);
    });
  }

  public next(): AchievementCard | undefined {
    const [first, ...rest] = this.queue();
    this.queue.set(rest);
    return first;
  }
}

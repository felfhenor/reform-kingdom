import { computed, effect, inject, Injectable, signal } from '@angular/core';
import type { Event } from '@angular/router';
import { NavigationEnd, Router } from '@angular/router';
import { bgmForWorld } from '@helpers/engine/bgm.ui';
import { gameloopShouldRun } from '@helpers/gameloop';
import { getOption } from '@helpers/state-options';
import type { BGM } from '@interfaces/sfx.ui';
import { SoundService } from '@services/sound.service';

// Combat ends a tick before auto mode's next travel starts, so only the drop back to casual waits.
const BGM_CASUAL_SETTLE_MS = 3000;

@Injectable({
  providedIn: 'root',
})
export class BGMService {
  private router = inject(Router);
  private soundService = inject(SoundService);

  private lastPlace = signal<'menu' | 'game' | ''>('');
  private currentPlace = signal<'menu' | 'game' | ''>('');
  private lastBGM = signal<BGM | undefined>(undefined);

  private lastBGMPlaySetting = signal<boolean>(getOption('bgmPlay'));
  private curBGMPlaySetting = computed(() => getOption('bgmPlay'));

  private worldBGM = computed(() => bgmForWorld());
  private settledWorldBGM = signal<BGM>('game-casual');

  constructor() {
    effect((onCleanup) => {
      const next = this.worldBGM();
      if (next !== 'game-casual' || !gameloopShouldRun()) {
        this.settledWorldBGM.set(next);
        return;
      }

      const timer = setTimeout(
        () => this.settledWorldBGM.set(next),
        BGM_CASUAL_SETTLE_MS,
      );
      onCleanup(() => clearTimeout(timer));
    });

    effect(() => {
      this.currentPlace();
      this.soundService.allowAudioInteractions();
      this.curBGMPlaySetting();
      this.settledWorldBGM();

      this.playAppropriateBGM();
    });
  }

  init() {
    this.router.events.subscribe((event: Event) => {
      if (!(event instanceof NavigationEnd)) return;

      const isInGame = event.url.includes('/game');
      this.currentPlace.set(isInGame ? 'game' : 'menu');
    });
  }

  private playAppropriateBGM() {
    if (!this.currentPlace() || !this.soundService.allowAudioInteractions())
      return;

    const nextBGM: BGM = gameloopShouldRun() ? this.settledWorldBGM() : 'menu';

    if (
      this.currentPlace() === this.lastPlace() &&
      this.curBGMPlaySetting() === this.lastBGMPlaySetting() &&
      this.lastBGM() === nextBGM
    )
      return;

    this.lastPlace.set(this.currentPlace());
    this.lastBGMPlaySetting.set(this.curBGMPlaySetting());

    this.lastBGM.set(nextBGM);

    this.soundService.playBGM(nextBGM);
  }
}

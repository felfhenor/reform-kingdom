import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  colosseumLiveFight,
  colosseumLiveFinish,
  colosseumLiveNext,
  colosseumLiveSkip,
  colosseumLiveStep,
} from '@helpers/colosseum/colosseum-run.ui';
import { combatSimulationLog } from '@helpers/combat/combat-log';
import { combatManualAwaitingOrders } from '@helpers/combat/combat-manual';
import {
  combatManualApply,
  combatManualOverlayVisible,
} from '@helpers/combat/combat-manual.ui';
import { COLOSSEUM_LIVE_STEP_MS } from '@helpers/config';
import type {
  Character,
  ColosseumFightOutcome,
  Combat,
  CombatManualAction,
  EncounterId,
} from '@interfaces';

// Drives one watched Colosseum fight on a timer; provided by the Colosseum page, so it ends with it.
@Injectable()
export class ColosseumFightService {
  // Undefined once the run is over, which turns the scene into its review.
  public combat = signal<Combat | undefined>(undefined);
  public outcome = signal<ColosseumFightOutcome | undefined>(undefined);
  public isPaused = signal(false);
  public speed = signal(1);

  private party: Character[] = [];
  private fightIndexes: number[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  // A finished fight stays on screen for one step, so its killing blow shows before the review.
  private pendingOutcome: ColosseumFightOutcome | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  public start(
    party: Character[],
    encounterId: EncounterId,
    fightIndexes: number[],
    manual: boolean,
  ): void {
    this.stop();
    this.pendingOutcome = undefined;
    combatSimulationLog.set([]);
    this.party = party;
    this.fightIndexes = fightIndexes;
    this.outcome.set(undefined);
    this.isPaused.set(false);
    this.combat.set(
      colosseumLiveFight(party, encounterId, fightIndexes[0] ?? 0, manual),
    );
    this.schedule();
  }

  public stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.combat.set(undefined);
  }

  public confirm(
    planned: Combat,
    action?: CombatManualAction,
    flee = false,
  ): void {
    const current = this.combat();
    if (!current) return;
    const next = structuredClone(current);
    combatManualApply(next, planned, action, flee);
    this.combat.set(next);
  }

  // Plays everything left at once, then leaves the last fight up for one step like a normal finish.
  public skipToEnd(): void {
    if (this.pendingOutcome) return;
    let current = this.combat();
    while (current) {
      const { combat, outcome } = colosseumLiveSkip(current);
      const next = outcome === 'Won' ? this.nextFight(combat) : undefined;
      if (!next) {
        this.combat.set(combat);
        this.pendingOutcome = outcome;
        return;
      }
      current = next;
    }
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.tick();
      if (this.combat()) this.schedule();
    }, COLOSSEUM_LIVE_STEP_MS / this.speed());
  }

  // The real Taskmaster overlay covers the page, so a sim waits behind it.
  private tick(): void {
    const current = this.combat();
    if (!current || this.isPaused() || combatManualOverlayVisible()) return;
    if (this.pendingOutcome) {
      this.settle(current, this.pendingOutcome);
      this.pendingOutcome = undefined;
      return;
    }
    if (combatManualAwaitingOrders(current)) return;

    const { combat, outcome } = colosseumLiveStep(current);
    this.combat.set(combat);
    this.pendingOutcome = outcome;
  }

  // The encounter's next fight, with HP carried over, if the run has one left.
  private nextFight(finished: Combat): Combat | undefined {
    const position = this.fightIndexes.indexOf(finished.fightIndex ?? -1);
    const nextIndex = this.fightIndexes[position + 1];
    if (nextIndex === undefined) return undefined;

    const next = colosseumLiveNext(this.party, finished, nextIndex);
    this.party = next.party;
    return next.combat;
  }

  private settle(finished: Combat, outcome: ColosseumFightOutcome): void {
    const next = outcome === 'Won' ? this.nextFight(finished) : undefined;
    if (next) {
      this.combat.set(next);
      return;
    }

    colosseumLiveFinish(finished, outcome);
    this.outcome.set(outcome);
    this.combat.set(undefined);
  }
}

import { notifyError } from '@helpers/engine/notify';
import { armoryHasRoom } from '@helpers/kingdom/armory';
import { updateGamestate } from '@helpers/state-game';
import type { GameState, TradeCommitOutcome } from '@interfaces';

const TRADE_FAILURE_MESSAGES: Partial<Record<TradeCommitOutcome, string>> = {
  armoryFull: 'Your armory is full.',
  vanished: 'That item has disappeared from the shop.',
};

export function tradeWarn(outcome: TradeCommitOutcome): void {
  const message = TRADE_FAILURE_MESSAGES[outcome];
  if (message) notifyError(message);
}

// Fast path before committing; the live re-check inside `tradeCommit` is what actually guards.
export function tradeArmoryHasRoom(quantity: number): boolean {
  if (armoryHasRoom(quantity)) return true;

  tradeWarn('armoryFull');
  return false;
}

// Awaited so `outcome` is set before it's read, even when the update is deferred outside a tick.
export async function tradeCommit(
  apply: (state: GameState) => TradeCommitOutcome,
): Promise<boolean> {
  let outcome = 'rejected' as TradeCommitOutcome;

  await updateGamestate((state) => {
    outcome = apply(state);
    return state;
  });

  tradeWarn(outcome);
  return outcome === 'executed';
}

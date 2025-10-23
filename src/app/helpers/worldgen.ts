import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import type { GameStateWorld } from '@interfaces';
import { Subject } from 'rxjs';

const _currentWorldGenStatus = signal<string>('');
export const currentWorldGenStatus: Signal<string> =
  _currentWorldGenStatus.asReadonly();

const cancelWorldGen = new Subject<void>();

export function cancelWorldGeneration(): void {
  cancelWorldGen.next();
}

export async function worldgenGenerateWorld(): Promise<
  GameStateWorld & { didFinish?: boolean }
> {
  //
  return {
    didFinish: true,
  };
}

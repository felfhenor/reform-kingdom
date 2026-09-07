import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';

const _currentWorldGenStatus = signal<string>('');
export const currentWorldGenStatus: Signal<string> =
  _currentWorldGenStatus.asReadonly();

const cancelWorldGen = new Subject<void>();

export function cancelWorldGeneration(): void {
  cancelWorldGen.next();
}

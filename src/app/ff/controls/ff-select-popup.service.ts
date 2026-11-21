import { Injectable, signal } from '@angular/core';
import type { FFSelectPopupRequest } from '@ff/interfaces/ff-input';

@Injectable({ providedIn: 'root' })
export class FFSelectPopupService {
  private readonly requestSignal = signal<FFSelectPopupRequest | undefined>(
    undefined,
  );

  public readonly request = this.requestSignal.asReadonly();

  public open(request: FFSelectPopupRequest): void {
    this.requestSignal.set(request);
  }

  public close(): void {
    this.requestSignal.set(undefined);
  }

  // Lets an opener that's going away drop its own popup without closing someone else's.
  public closeIf(request: FFSelectPopupRequest): void {
    if (this.requestSignal() === request) this.close();
  }
}

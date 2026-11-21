import { Injectable, signal } from '@angular/core';
import type { FFNumberPopupRequest } from '@ff/interfaces/ff-input';

@Injectable({ providedIn: 'root' })
export class FFNumberPopupService {
  private readonly requestSignal = signal<FFNumberPopupRequest | undefined>(
    undefined,
  );

  public readonly request = this.requestSignal.asReadonly();

  public open(request: FFNumberPopupRequest): void {
    this.requestSignal.set(request);
  }

  public close(): void {
    this.requestSignal.set(undefined);
  }

  // Lets an opener that's going away drop its own popup without closing someone else's.
  public closeIf(request: FFNumberPopupRequest): void {
    if (this.requestSignal() === request) this.close();
  }
}

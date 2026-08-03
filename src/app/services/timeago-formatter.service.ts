import { Injectable } from '@angular/core';
import { TimeagoDefaultFormatter, TimeagoFormatter } from 'ngx-timeago';

const JUST_NOW_THRESHOLD_SECONDS = 60;

@Injectable({ providedIn: 'root' })
export class AdventureLogTimeagoFormatter extends TimeagoFormatter {
  private fallback = new TimeagoDefaultFormatter();

  override format(then: number): string {
    const secondsAgo = Math.abs(Date.now() - then) / 1000;
    if (secondsAgo < JUST_NOW_THRESHOLD_SECONDS) return 'just now';

    return this.fallback.format(then);
  }
}

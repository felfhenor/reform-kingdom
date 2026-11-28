import { Injectable } from '@angular/core';
import { i18nLocale, t } from '@helpers/i18n/i18n';
import { TimeagoFormatter } from 'ngx-timeago';

const JUST_NOW_THRESHOLD_SECONDS = 60;
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

// Intl already words relative times in every language, so only "just now" needs a translation.
@Injectable({ providedIn: 'root' })
export class AdventureLogTimeagoFormatter extends TimeagoFormatter {
  private formatter?: Intl.RelativeTimeFormat;

  // The language only changes across a reload, so one formatter serves the session.
  private relativeFormat(): Intl.RelativeTimeFormat {
    this.formatter ??= new Intl.RelativeTimeFormat(i18nLocale(), {
      numeric: 'always',
    });
    return this.formatter;
  }

  override format(then: number): string {
    const secondsAgo = Math.abs(Date.now() - then) / 1000;
    if (secondsAgo < JUST_NOW_THRESHOLD_SECONDS) return t('timeago.justNow');

    const [unit, size] =
      RELATIVE_UNITS.find(([, seconds]) => secondsAgo >= seconds) ??
      RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
    return this.relativeFormat().format(-Math.floor(secondsAgo / size), unit);
  }
}

import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import { tPlural } from '@helpers/i18n/i18n';
import type { I18nParams, I18nPluralKey } from '@interfaces';

// Pure: the language only changes across a reload.
@Pipe({
  name: 'tPlural',
})
export class TPluralPipe implements PipeTransform {
  transform(key: I18nPluralKey, count: number, params?: I18nParams): string {
    return tPlural(key, count, params);
  }
}

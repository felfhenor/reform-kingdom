import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import { t } from '@helpers/i18n/i18n';
import type { I18nKey, I18nParams } from '@interfaces';

// Pure: the language only changes across a reload.
@Pipe({
  name: 't',
})
export class TPipe implements PipeTransform {
  transform(key: I18nKey, params?: I18nParams): string {
    return t(key, params);
  }
}

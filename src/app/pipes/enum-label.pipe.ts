import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import { enumLabel } from '@helpers/i18n/i18n';
import type { I18nEnumGroup } from '@interfaces';

// Pure: the language only changes across a reload.
@Pipe({
  name: 'enumLabel',
})
export class EnumLabelPipe implements PipeTransform {
  transform(value: string, group: I18nEnumGroup): string {
    return enumLabel(group, value);
  }
}

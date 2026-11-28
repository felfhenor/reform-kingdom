import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import { contentName } from '@helpers/i18n/i18n-content';
import type { IsContentItem } from '@interfaces';

// Pure: the language only changes across a reload.
@Pipe({
  name: 'contentName',
})
export class ContentNamePipe implements PipeTransform {
  transform(entry?: IsContentItem): string {
    return entry ? contentName(entry) : '';
  }
}

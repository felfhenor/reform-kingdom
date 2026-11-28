import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import { contentDescription } from '@helpers/i18n/i18n-content';
import type { IsContentItem } from '@interfaces';

// Pure: the language only changes across a reload.
@Pipe({
  name: 'contentDescription',
})
export class ContentDescriptionPipe implements PipeTransform {
  transform(entry?: IsContentItem): string {
    return entry ? contentDescription(entry) : '';
  }
}

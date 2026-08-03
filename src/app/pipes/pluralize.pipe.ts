import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';
import { pluralize } from '@boringnode/pluralize';

@Pipe({
  name: 'pluralize',
})
export class PluralizePipe implements PipeTransform {
  transform(value: string, shouldPluralize: boolean): unknown {
    if (!shouldPluralize) return value;

    return pluralize(value);
  }
}

import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({
  name: 'statDisplay',
})
export class StatDisplayPipe implements PipeTransform {
  transform(value: number, maxDecimals = 0, showSign = true): string {
    const sign = showSign && value > 0 ? '+' : '';
    const formatted =
      maxDecimals > 0
        ? new Intl.NumberFormat('en-US', {
            maximumFractionDigits: maxDecimals,
          }).format(value)
        : `${value}`;

    return `${sign}${formatted}`;
  }
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { BlankSlateSize } from '@interfaces';

@Component({
  selector: 'app-blank-slate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-content></ng-content>
  `,
  host: {
    '[class]':
      "size() === 'page' ? 'flex justify-center items-center w-full h-full text-2xl text-lighter' : 'block text-sm text-lighter text-center p-2 border border-dashed border-base-content/25'",
  },
})
export class BlankSlateComponent {
  public size = input<BlankSlateSize>('inline');
}

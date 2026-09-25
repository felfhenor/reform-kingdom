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
      "size() === 'page' ? 'flex justify-center items-center w-full h-full text-2xl italic text-lighter' : 'block text-sm italic text-lighter p-2 text-center'",
  },
})
export class BlankSlateComponent {
  public size = input<BlankSlateSize>('inline');
}

import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-icon-mod-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  host: { class: 'block shrink-0 w-32 h-18' },
  template: `
    @if (url(); as src) {
      <img
        [ngSrc]="src"
        width="128"
        height="72"
        [alt]="name()"
        class="block size-full object-cover"
      />
    } @else {
      <div
        class="size-full border-2 border-dashed border-base-content/30"
        aria-hidden="true"
      ></div>
    }
  `,
})
export class IconModLogoComponent {
  public url = input<string>();
  public name = input.required<string>();
}

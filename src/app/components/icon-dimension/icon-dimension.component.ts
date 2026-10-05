import { Component, computed, input } from '@angular/core';
import { IconComponent } from '@components/icon/icon.component';
import type { IconSize, StatDisplayDimension } from '@interfaces';

@Component({
  selector: 'app-icon-dimension',
  imports: [IconComponent],
  template: `
    <app-icon [size]="size()" [name]="icon()" [class]="color()"></app-icon>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class IconDimensionComponent {
  public dimension = input.required<StatDisplayDimension>();
  public key = input.required<string>();
  public size = input<IconSize>('stat');

  public icon = computed(() => this.dimension().icon[this.key()]);
  public color = computed(() => this.dimension().color?.[this.key()] ?? '');
}

import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { KingdomIcon } from '@interfaces';

@Component({
  selector: 'app-icon-kingdom',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  template: `
    <img [ngSrc]="src()" width="64" height="64" alt="" />
  `,
})
export class IconKingdomComponent {
  public name = input.required<KingdomIcon>();

  public src = computed(() => `asset/kingdom/${this.name()}.png`);
}

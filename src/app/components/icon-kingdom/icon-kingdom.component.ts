import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { kingdomIconURL } from '@helpers/kingdom/kingdom-nav.ui';
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

  public src = computed(() => kingdomIconURL(this.name()));
}
